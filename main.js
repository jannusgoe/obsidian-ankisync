'use strict';

var obsidian = require('obsidian');

class AnkiSyncPlugin extends obsidian.Plugin {
    async onload() {
        console.log('Loading AnkiSyncPlugin');

        await this.loadSettings();

        this.addCommand({
            id: 'scan-and-sync-anki-cards',
            name: 'Scan and Sync Anki Cards',
            callback: () => this.scanAndSyncCards()
        });

        this.addSettingTab(new AnkiSyncSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log('Unloading AnkiSyncPlugin');
    }

    async scanAndSyncCards() {
        console.log('Starting scanAndSyncCards');
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile instanceof obsidian.TFile) {
            console.log('Active file found:', activeFile.path);
            const content = await this.app.vault.read(activeFile);
            const cards = this.parseCardsAndTagsFromContent(content);
            console.log('Found cards:', cards);
            
            let deckName = this.settings.defaultDeck;
            if (this.settings.automaticDeckAssignment) {
                deckName = this.getDeckNameFromFile(activeFile);
            }
            await this.ensureDeckExists(deckName);
            
            let addedCount = 0;
            let updatedCount = 0;
            for (const card of cards) {
                try {
                    console.log('Processing card:', card);
                    let processedCard = card;
                    if (this.settings.enableAIEnhancement) {
                        try {
                            processedCard = await this.enhanceCardWithAI(card);
                            console.log('AI-enhanced card:', processedCard);
                        } catch (aiError) {
                            console.error('Error enhancing card with AI:', aiError);
                            new obsidian.Notice(`Failed to enhance card with AI. Using original content.`);
                        }
                    }
                    
                    let tags = this.settings.automaticTagAssignment ? processedCard.tags : [];
                    if (this.settings.defaultTags) {
                        tags = tags.concat(this.settings.defaultTags.split(',').map(tag => tag.trim()));
                    }
                    
                    console.log('Attempting to add/update card:', processedCard);
                    const result = await this.addOrUpdateNoteInAnki(processedCard.front, processedCard.back, deckName, tags);
                    console.log('Add/Update note result:', result);
                    if (result.added) {
                        addedCount++;
                    } else if (result.updated) {
                        updatedCount++;
                    }
                } catch (error) {
                    console.error('Error processing card:', error);
                    new obsidian.Notice(`Failed to process card: ${card.front}. Error: ${error.message}`);
                }
            }
            new obsidian.Notice(`Sync complete. Added: ${addedCount}, Updated: ${updatedCount} in deck: ${deckName}`);
        } else {
            console.log('No active file');
            new obsidian.Notice('No active file');
        }
    }

    async enhanceCardWithAI(card) {
        console.log('Enhancing card with AI:', card);
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API key is not set');
        }

        const userPrompt = `Enhance the following flashcard:
        Front: ${card.front}
        Back: ${card.back}`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.settings.aiModel,
                    messages: [
                        {"role": "system", "content": this.settings.aiPrompt},
                        {"role": "user", "content": userPrompt}
                    ],
                    response_format: {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "enhanced_flashcard",
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "front": { "type": "string" },
                                    "back": { "type": "string" }
                                },
                                "required": ["front", "back"],
                                "additionalProperties": false
                            },
                            "strict": true
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            const enhancedContent = JSON.parse(data.choices[0].message.content);

            return {
                ...card,
                front: enhancedContent.front,
                back: enhancedContent.back
            };
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            throw error;
        }
    }


    getDeckNameFromFile(file) {
        return file.basename.replace(/\s+/g, '_');
    }

    async ensureDeckExists(deckName) {
        const deckNames = await this.invokeAnkiConnect('deckNames');
        if (!deckNames.result.includes(deckName)) {
            console.log(`Creating new deck: ${deckName}`);
            await this.invokeAnkiConnect('createDeck', { deck: deckName });
        }
    }

    async addOrUpdateNoteInAnki(front, back, deckName, tags) {
        console.log('Adding or updating note in Anki:', front, back, 'in deck:', deckName, 'with tags:', tags);
        const note = {
            deckName: deckName,
            modelName: "Basic",
            fields: {
                Front: front,
                Back: back
            },
            options: {
                allowDuplicate: false,
                duplicateScope: "deck"
            },
            tags: tags
        };

        const existingNotes = await this.invokeAnkiConnect('findNotes', {
            query: `"front:${front}" deck:${deckName}`
        });

        if (existingNotes.result && existingNotes.result.length > 0) {
            const updateResult = await this.invokeAnkiConnect('updateNoteFields', {
                note: {
                    id: existingNotes.result[0],
                    fields: {
                        Front: front,
                        Back: back
                    }
                }
            });
            // Aktualisiere Tags separat
            await this.invokeAnkiConnect('removeTags', {
                notes: existingNotes.result,
                tags: ""  // Entfernt alle bestehenden Tags
            });
            await this.invokeAnkiConnect('addTags', {
                notes: existingNotes.result,
                tags: tags.join(' ')
            });
            console.log('Update result:', updateResult);
            return { updated: true };
        } else {
            const addResult = await this.invokeAnkiConnect('addNote', { note });
            console.log('Add result:', addResult);
            return { added: true };
        }
    }

    async invokeAnkiConnect(action, params = {}) {
        console.log('Invoking AnkiConnect:', action, params);
        try {
            const response = await fetch('http://localhost:8765', {
                method: 'POST',
                body: JSON.stringify({ action, version: 6, params })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const responseJson = await response.json();
            console.log('AnkiConnect raw response:', responseJson);
    
            if (responseJson.error) {
                throw new Error(responseJson.error);
            }
    
            return responseJson;
        } catch (error) {
            console.error('Error invoking AnkiConnect:', error);
            new obsidian.Notice(`Failed to connect to Anki: ${error.message}. Make sure Anki is running and AnkiConnect is installed`);
            throw error;
        }
    }

    parseCardsAndTagsFromContent(content) {
        const lines = content.split('\n');
        const cards = [];
        const headings = {};
        const cardRegex = /- (.*?)::([^-\n]*($|\n)|)/;

        lines.forEach((line, index) => {
            if (line.startsWith('#')) {
                const level = line.match(/^#+/)[0].length;
                const text = line.replace(/^#+\s*/, '').trim().toLowerCase().replace(/\s+/g, '_');
                headings[level] = text;
                
                Object.keys(headings).forEach(key => {
                    if (parseInt(key) > level) {
                        delete headings[key];
                    }
                });
            } else {
                const match = line.match(cardRegex);
                if (match) {
                    const front = match[1].trim();
                    const back = match[2] ? match[2].trim() : '';
                    if (front) {
                        const tags = this.createHierarchicalTags(headings);
                        cards.push({ front, back, tags });
                        console.log(`Parsed card - Front: "${front}", Back: "${back}", Tags: ${tags.join(', ')}`);
                    }
                }
            }
        });

        console.log(`Total parsed cards: ${cards.length}`);
        return cards;
    }

    createHierarchicalTags(headings) {
        const tags = [];
        let currentTag = '';
        Object.keys(headings).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
            currentTag += (currentTag ? '/' : '') + headings[level];
            tags.push(currentTag);
        });
        return tags;
    }
}

const DEFAULT_SETTINGS = {
    apiKey: '',
    enableAIEnhancement: true,
    aiPrompt: "You are an AI assistant that enhances flashcards. Improve the content on front and back by making it clearer, more concise, and more effective for learning but without changing the meaning. Treat the back as a hint on how you are suppossed to enhance the back if it's not a complete answer (e.g., If asks for specific data, provide the actual data). Use HTML for formatting (e.g., <strong>, <em>, <code>, <ul>, <li>). Always answer in the given language and ensure proper HTML formatting.",
    defaultDeck: "Default",
    defaultTags: "",
    aiModel: "gpt-4o",
    automaticDeckAssignment: true,
    automaticTagAssignment: true
};

class AnkiSyncSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        let {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'AnkiSync Settings'});

        new obsidian.Setting(containerEl)
            .setName('OpenAI API Key')
            .setDesc('Enter your OpenAI API key')
            .addText(text => text
                .setPlaceholder('Enter API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Enable AI Enhancement')
            .setDesc('Use a language model to enhance your flashcards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAIEnhancement)
                .onChange(async (value) => {
                    this.plugin.settings.enableAIEnhancement = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Prompt')
            .setDesc('Customize the system prompt sent to the model for card enhancement')
            .addTextArea(text => text
                .setPlaceholder('Enter AI prompt')
                .setValue(this.plugin.settings.aiPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.aiPrompt = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('AI Model')
            .setDesc('Choose the OpenAI model used for card enhancement')
            .addDropdown(dropdown => dropdown
                .addOption('gpt-4o', 'GPT-4o')
                .addOption('gpt-4o-mini', 'GPT-4o mini')
                .setValue(this.plugin.settings.aiModel)
                .onChange(async (value) => {
                    this.plugin.settings.aiModel = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Deck Assignment')
            .setDesc('Automatically assign decks based on file names')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automaticDeckAssignment)
                .onChange(async (value) => {
                    this.plugin.settings.automaticDeckAssignment = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Default Deck')
            .setDesc('The default deck to add new cards to')
            .addText(text => text
                .setPlaceholder('Enter default deck name')
                .setValue(this.plugin.settings.defaultDeck)
                .onChange(async (value) => {
                    this.plugin.settings.defaultDeck = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Tag Assignment')
            .setDesc('Automatically assign tags based on headings')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automaticTagAssignment)
                .onChange(async (value) => {
                    this.plugin.settings.automaticTagAssignment = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Default Tags')
            .setDesc('Default tags for new cards (comma-separated)')
            .addText(text => text
                .setPlaceholder('Enter default tags')
                .setValue(this.plugin.settings.defaultTags)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTags = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = AnkiSyncPlugin;