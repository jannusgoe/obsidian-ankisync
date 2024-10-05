'use strict';

var obsidian = require('obsidian');

class AnkiSyncPlugin extends obsidian.Plugin {
    async onload() {
        console.log('Loading AnkiSyncPlugin');

        this.addCommand({
            id: 'scan-and-sync-anki-cards',
            name: 'Scan and Sync Anki Cards',
            callback: () => this.scanAndSyncCards()
        });
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
            
            const deckName = this.getDeckNameFromFile(activeFile);
            await this.ensureDeckExists(deckName);
            
            let addedCount = 0;
            let updatedCount = 0;
            for (const card of cards) {
                try {
                    console.log('Attempting to add/update card:', card);
                    const result = await this.addOrUpdateNoteInAnki(card.front, card.back, deckName, card.tags);
                    console.log('Add/Update note result:', result);
                    if (result.added) {
                        addedCount++;
                    } else if (result.updated) {
                        updatedCount++;
                    }
                } catch (error) {
                    console.error('Error adding/updating card:', error);
                    new obsidian.Notice(`Failed to add/update card: ${card.front}. Error: ${error.message}`);
                }
            }
            new obsidian.Notice(`Sync complete. Added: ${addedCount}, Updated: ${updatedCount} in deck: ${deckName}`);
        } else {
            console.log('No active file');
            new obsidian.Notice('No active file');
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

            const responseJson = await response.json();
            console.log('AnkiConnect raw response:', responseJson);
            return responseJson;
        } catch (error) {
            console.error('Error invoking AnkiConnect:', error);
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
                // Entferne alle Überschriften höherer Ebenen
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

module.exports = AnkiSyncPlugin;