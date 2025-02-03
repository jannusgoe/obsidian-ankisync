'use strict';

var obsidian = require('obsidian');
var { requestUrl } = require('obsidian');

class AnkiSyncPlugin extends obsidian.Plugin {
    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'scan-and-sync-anki-cards',
            name: 'Scan and sync Anki cards',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                const aiRequirementsMet = !this.settings.enableAIEnhancement || 
                    (this.settings.enableAIEnhancement && this.settings.apiKey);
                const deckConfigured = this.settings.defaultDeck || this.settings.automaticDeckAssignment;

                if (!checking && !activeFile) {
                    new obsidian.Notice('Please open a file first');
                    return false;
                }

                if (!checking && !aiRequirementsMet) {
                    new obsidian.Notice('Please configure OpenAI API key or disable AI enhancement');
                    return false;
                }

                if (!checking && !deckConfigured) {
                    new obsidian.Notice('Please configure deck settings');
                    return false;
                }

                if (activeFile instanceof obsidian.TFile && aiRequirementsMet && deckConfigured) {
                    if (!checking) {
                        this.scanAndSyncCards();
                    }
                    return true;
                }

                return false;
            }
        });

        this.addSettingTab(new AnkiSyncSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async scanAndSyncCards() {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile instanceof obsidian.TFile) {
            const content = await this.app.vault.read(activeFile);
            const cards = this.parseCardsAndTagsFromContent(content);
            
            let deckName = this.settings.defaultDeck;
            if (this.settings.automaticDeckAssignment) {
                deckName = this.getDeckNameFromFile(activeFile);
            }
            await this.ensureDeckExists(deckName);
            
            let addedCount = 0;
            let updatedCount = 0;
            const totalCards = cards.length;
            let progressNotice = new obsidian.Notice(`Processing cards: 0/${totalCards}`, 0);

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                try {
                    // Update progress notification
                    progressNotice.hide();
                    progressNotice = new obsidian.Notice(`Processing cards: ${i + 1}/${totalCards}`, 2000);

                    let processedCard = card;
                    if (this.settings.enableAIEnhancement) {
                        try {
                            processedCard = await this.enhanceCardWithAI(card);
                        } catch (aiError) {
                            new obsidian.Notice(`Failed to enhance card with AI. Using original content.`, 3000);
                        }
                    }
                    
                    let tags = this.settings.automaticTagAssignment ? processedCard.tags : [];
                    if (this.settings.defaultTags) {
                        tags = tags.concat(this.settings.defaultTags.split(',').map(tag => tag.trim()));
                    }
                    
                    const result = await this.addOrUpdateNoteInAnki(processedCard.front, processedCard.back, deckName, tags);
                    if (result.added) {
                        addedCount++;
                    } else if (result.updated) {
                        updatedCount++;
                    }
                } catch (error) {
                    new obsidian.Notice(`Failed to process card: ${card.front}. Error: ${error.message}`, 3000);
                }
            }

            // Hide the progress notice and show final result
            progressNotice.hide();
            new obsidian.Notice(`Sync complete. Added: ${addedCount}, Updated: ${updatedCount} in deck: ${deckName}`, 4000);
        } else {
            new obsidian.Notice('No active file');
        }
    }

    async enhanceCardWithAI(card) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API key is not set');
        }

        const userPrompt = `Enhance the following flashcard:
        Front: ${card.front}
        Back: ${card.back}`;

        const response = await requestUrl({
            url: 'https://api.openai.com/v1/chat/completions',
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

        try {
            const data = response.json;
            const enhancedContent = JSON.parse(data.choices[0].message.content);
            return {
                ...card,
                front: enhancedContent.front,
                back: enhancedContent.back
            };
        } catch (error) {
            throw new Error('Failed to parse AI response');
        }
    }


    getDeckNameFromFile(file) {
        return file.basename.replace(/\s+/g, '_');
    }

    async ensureDeckExists(deckName) {
        const deckNames = await this.invokeAnkiConnect('deckNames');
        if (!deckNames.result.includes(deckName)) {
            await this.invokeAnkiConnect('createDeck', { deck: deckName });
        }
    }

    async addOrUpdateNoteInAnki(front, back, deckName, tags) {
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
            
            await this.invokeAnkiConnect('removeTags', {
                notes: existingNotes.result,
                tags: ""  
            });
            await this.invokeAnkiConnect('addTags', {
                notes: existingNotes.result,
                tags: tags.join(' ')
            });
            return { updated: true };
        } else {
            const addResult = await this.invokeAnkiConnect('addNote', { note });
            return { added: true };
        }
    }

    async invokeAnkiConnect(action, params = {}) {
        try {
            const response = await requestUrl({
                url: 'http://localhost:8765',
                method: 'POST',
                body: JSON.stringify({ action, version: 6, params })
            });
    
            const responseJson = JSON.parse(response.text);
    
            if (responseJson.error) {
                throw new Error(responseJson.error);
            }
    
            return responseJson;
        } catch (error) {
            new obsidian.Notice(`Failed to connect to Anki: ${error.message}. Make sure Anki is running and AnkiConnect is installed`);
            throw error;
        }
    }

    parseCardsAndTagsFromContent(content) {
        const lines = content.split('\n');
        const cards = [];
        const headings = {};
        const cardRegex = /- (.*?)==(.+)?/;

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
                    }
                }
            }
        });

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
    aiPrompt: "You are an AI assistant that enhances anki flashcards. Improve the content on front and back by making it clearer, more concise, and more effective for learning but without changing the meaning. The backside may contain hints for the answer, instructions for creating the answer, or the complete answer. If nothing is provided on the backside, the answer should be generated entirely. If parts of the answer are provided, they should always be used. If appropriate use HTML for formatting. Always answer in the given language and ensure proper HTML formatting.",
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

        new obsidian.Setting(containerEl)
            .setName('OpenAI API key')
            .setDesc('Enter your OpenAI API key')
            .addText(text => text
                .setPlaceholder('Enter API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Enable AI enhancement')
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
            .setName('AI model')
            .setDesc('Choose the OpenAI model used for card enhancement')
            .addDropdown(dropdown => dropdown
                .addOption('gpt-4o', 'GPT-4o')
                .addOption('gpt-4o-mini', 'GPT-4o mini')
                .addOption('o3-mini', 'o3 mini')
                .addOption('o1', 'o1')
                .addOption('o1-mini', 'o1 mini')
                .setValue(this.plugin.settings.aiModel)
                .onChange(async (value) => {
                    this.plugin.settings.aiModel = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Deck assignment')
            .setDesc('Automatically assign decks based on file names')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automaticDeckAssignment)
                .onChange(async (value) => {
                    this.plugin.settings.automaticDeckAssignment = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Default deck')
            .setDesc('The default deck to add new cards to')
            .addText(text => text
                .setPlaceholder('Enter default deck name')
                .setValue(this.plugin.settings.defaultDeck)
                .onChange(async (value) => {
                    this.plugin.settings.defaultDeck = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Tag assignment')
            .setDesc('Automatically assign tags based on headings')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automaticTagAssignment)
                .onChange(async (value) => {
                    this.plugin.settings.automaticTagAssignment = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('Default tags')
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
