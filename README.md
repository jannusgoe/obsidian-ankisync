# AI-AnkiSync for Obsidian

AI-AnkiSync is an Obsidian plugin that detects flashcards in your notes, enhances the content using a language model, and syncs them with Anki via AnkiConnect. The AI enhancement allows users to input brief keywords, automating the expansion and formatting of flashcards, which speeds up the creation process.

## Features

- Flashcard detection in Obsidian notes (Remnote like)
- AI-powered enhancement of flashcard content using OpenAI's language models
- Synchronization with Anki via AnkiConnect
- Automatic deck assignment based on file names
- Hierarchical tag assignment based on note structure (headings as tags)
- Customizable system prompt for card enhancement

## Installation

1. Open Obsidian and go to Settings > Community Plugins
2. Disable Safe Mode if it's enabled
3. Click on "Browse" and search for "AI-AnkiSync"
4. Click "Install"
5. Once installed, enable the plugin in the Community Plugins tab

## Setting up the plugin

1. Go to the AI-AnkiSync settings in Obsidian
2. Enter your OpenAI API key
3. Configure other settings as desired (default deck, AI model, etc.)
4. Ensure Anki is running and AnkiConnect is installed in Anki
5. Configure AnkiConnect to allow connections from Obsidian:
    - In Anki, go to Tools > Add-ons > AnkiConnect > Config
    - Find the 'webCorsOriginList' setting and add 'app://obsidian.md' to the list. It should look something like this:
        ```json
        "webCorsOriginList": [
            "http://localhost",
            "https://localhost",
            "app://obsidian.md"
        ]
        ```
    - Save the config and restart Anki

## Usage

### Creating flashcards

Create flashcards in your Obsidian notes using the following format:

```markdown
- Front of card==Back of card
```

You can organize your cards under headings, which will be used for automatic tag assignment:

```markdown
# Topic
## Suptopic 1
text
## Subtopic 2
- Question==Answer
```
This assigns the following tags: 'topic', 'topic/subtopic_2'

### Syncing with Anki

1. Open the note containing your flashcards
2. Use the command palette (Ctrl/Cmd + P) and search for "Scan and Sync Anki Cards"
3. Run the command to sync your cards with Anki

## Configuration

### Plugin Settings

- **OpenAI API Key**: Your API key for accessing OpenAI's models
- **Enable AI Enhancement**: Toggle to enable/disable AI enhancement of cards
- **AI Model**: Choose between GPT-4o and GPT-4o mini
- **Deck Assignment**: Automatically assign decks based on file names
- **Default Deck**: The default deck for new cards if automatic assignment is off
- **Tag Assignment**: Automatically assign tags based on note structure
- **Default Tags**: Default tags to apply to all cards

### AI Enhancement

You can customize the system prompt that is sent to the model. The default prompt is: 

```markdown
You are an AI assistant that enhances flashcards. Improve the content on front and back by making it clearer, more concise, and more effective for learning but without changing the meaning. Treat the back as a hint on how you are suppossed to enhance the back if it's not a complete answer (e.g., If asks for specific data, provide the actual data). If appropriate use HTML for formatting (e.g., <strong>, <em>, <code>, <ul>, <li>). Always answer in the given language and ensure proper HTML formatting.
```


## How it works

1. The plugin scans the active note for flashcard-formatted lines
2. If AI enhancement is enabled, each card is sent to the OpenAI API for improvement
3. The plugin checks if the card already exists in Anki
4. New cards are added to Anki, existing cards are updated
5. Tags are assigned based on the note's heading structure
6. The deck is assigned based on the file name or the default setting

## Troubleshooting

- **Cards not syncing**: Ensure Anki is running and AnkiConnect is properly installed
- **AI enhancement not working**: Check your OpenAI API key and internet connection
- **Unexpected deck assignments**: Review your automatic deck assignment settings

If you encounter persistent issues, check the console logs in Obsidian's developer tools for more detailed error messages.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgements

- This plugin uses the AnkiConnect add-on for Anki
- AI enhancement is currently powered by OpenAI's GPT-4o series
