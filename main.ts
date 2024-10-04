import { Plugin, TFile, Notice } from 'obsidian';

interface AnkiConnectResponse {
  result: any;
  error: string | null;
}

export default class AnkiSyncPlugin extends Plugin {
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
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile instanceof TFile) {
      const content = await this.app.vault.read(activeFile);
      const cards = this.parseCardsFromContent(content);
      console.log('Found cards:', cards);
      
      for (const card of cards) {
        try {
          await this.addNoteToAnki(card.front, card.back);
          new Notice(`Added card: ${card.front}`);
        } catch (error) {
          new Notice(`Failed to add card: ${card.front}. Error: ${error.message}`);
        }
      }
    } else {
      new Notice('No active file');
    }
  }

  async addNoteToAnki(front: string, back: string) {
    const note = {
      deckName: "Default",
      modelName: "Basic",
      fields: {
        Front: front,
        Back: back
      },
      options: {
        allowDuplicate: false,
        duplicateScope: "deck"
      },
      tags: ["obsidian-sync"]
    };

    const response = await this.invokeAnkiConnect('addNote', { note });
    if (response.error) {
      throw new Error(response.error);
    }
    return response.result;
  }

  async invokeAnkiConnect(action: string, params = {}) {
    const response = await fetch('http://localhost:8765', {
      method: 'POST',
      body: JSON.stringify({ action, version: 6, params })
    });

    const responseJson: AnkiConnectResponse = await response.json();
    return responseJson;
  }

  parseCardsFromContent(content: string): Array<{front: string, back: string}> {
    const cardRegex = /- (.*?)::(.*?) (?=\n- (.*?)::|$)/g;
    const cards = [];
    let match;

    while ((match = cardRegex.exec(content)) !== null) {
      cards.push({
        front: match[1].trim(),
        back: match[2].trim()
      });
    }

    return cards;
  }
}