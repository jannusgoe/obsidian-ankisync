import { __awaiter } from "tslib";
import { Plugin, TFile, Notice } from 'obsidian';
export default class AnkiSyncPlugin extends Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Loading AnkiSyncPlugin');
            this.addCommand({
                id: 'scan-and-sync-anki-cards',
                name: 'Scan and Sync Anki Cards',
                callback: () => this.scanAndSyncCards()
            });
        });
    }
    onunload() {
        console.log('Unloading AnkiSyncPlugin');
    }
    scanAndSyncCards() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile instanceof TFile) {
                const content = yield this.app.vault.read(activeFile);
                const cards = this.parseCardsFromContent(content);
                console.log('Found cards:', cards);
                for (const card of cards) {
                    try {
                        yield this.addNoteToAnki(card.front, card.back);
                        new Notice(`Added card: ${card.front}`);
                    }
                    catch (error) {
                        new Notice(`Failed to add card: ${card.front}. Error: ${error.message}`);
                    }
                }
            }
            else {
                new Notice('No active file');
            }
        });
    }
    addNoteToAnki(front, back) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const response = yield this.invokeAnkiConnect('addNote', { note });
            if (response.error) {
                throw new Error(response.error);
            }
            return response.result;
        });
    }
    invokeAnkiConnect(action_1) {
        return __awaiter(this, arguments, void 0, function* (action, params = {}) {
            const response = yield fetch('http://localhost:8765', {
                method: 'POST',
                body: JSON.stringify({ action, version: 6, params })
            });
            const responseJson = yield response.json();
            return responseJson;
        });
    }
    parseCardsFromContent(content) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLFVBQVUsQ0FBQztBQU9qRCxNQUFNLENBQUMsT0FBTyxPQUFPLGNBQWUsU0FBUSxNQUFNO0lBQzFDLE1BQU07O1lBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1lBRXRDLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQ2QsRUFBRSxFQUFFLDBCQUEwQjtnQkFDOUIsSUFBSSxFQUFFLDBCQUEwQjtnQkFDaEMsUUFBUSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTthQUN4QyxDQUFDLENBQUM7UUFDTCxDQUFDO0tBQUE7SUFFRCxRQUFRO1FBQ04sT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFSyxnQkFBZ0I7O1lBQ3BCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3RELElBQUksVUFBVSxZQUFZLEtBQUssRUFBRSxDQUFDO2dCQUNoQyxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDdEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNsRCxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFFbkMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDekIsSUFBSSxDQUFDO3dCQUNILE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDaEQsSUFBSSxNQUFNLENBQUMsZUFBZSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztvQkFDMUMsQ0FBQztvQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO3dCQUNmLElBQUksTUFBTSxDQUFDLHVCQUF1QixJQUFJLENBQUMsS0FBSyxZQUFZLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO29CQUMzRSxDQUFDO2dCQUNILENBQUM7WUFDSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sSUFBSSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMvQixDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRUssYUFBYSxDQUFDLEtBQWEsRUFBRSxJQUFZOztZQUM3QyxNQUFNLElBQUksR0FBRztnQkFDWCxRQUFRLEVBQUUsU0FBUztnQkFDbkIsU0FBUyxFQUFFLE9BQU87Z0JBQ2xCLE1BQU0sRUFBRTtvQkFDTixLQUFLLEVBQUUsS0FBSztvQkFDWixJQUFJLEVBQUUsSUFBSTtpQkFDWDtnQkFDRCxPQUFPLEVBQUU7b0JBQ1AsY0FBYyxFQUFFLEtBQUs7b0JBQ3JCLGNBQWMsRUFBRSxNQUFNO2lCQUN2QjtnQkFDRCxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUM7YUFDeEIsQ0FBQztZQUVGLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDbkUsSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFDekIsQ0FBQztLQUFBO0lBRUssaUJBQWlCOzZEQUFDLE1BQWMsRUFBRSxNQUFNLEdBQUcsRUFBRTtZQUNqRCxNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyx1QkFBdUIsRUFBRTtnQkFDcEQsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQzthQUNyRCxDQUFDLENBQUM7WUFFSCxNQUFNLFlBQVksR0FBd0IsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEUsT0FBTyxZQUFZLENBQUM7UUFDdEIsQ0FBQztLQUFBO0lBRUQscUJBQXFCLENBQUMsT0FBZTtRQUNuQyxNQUFNLFNBQVMsR0FBRyxtQ0FBbUMsQ0FBQztRQUN0RCxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDakIsSUFBSSxLQUFLLENBQUM7UUFFVixPQUFPLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNsRCxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUNULEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO2dCQUN0QixJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRTthQUN0QixDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQbHVnaW4sIFRGaWxlLCBOb3RpY2UgfSBmcm9tICdvYnNpZGlhbic7XG5cbmludGVyZmFjZSBBbmtpQ29ubmVjdFJlc3BvbnNlIHtcbiAgcmVzdWx0OiBhbnk7XG4gIGVycm9yOiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBbmtpU3luY1BsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZygnTG9hZGluZyBBbmtpU3luY1BsdWdpbicpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnc2Nhbi1hbmQtc3luYy1hbmtpLWNhcmRzJyxcbiAgICAgIG5hbWU6ICdTY2FuIGFuZCBTeW5jIEFua2kgQ2FyZHMnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMuc2NhbkFuZFN5bmNDYXJkcygpXG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZygnVW5sb2FkaW5nIEFua2lTeW5jUGx1Z2luJyk7XG4gIH1cblxuICBhc3luYyBzY2FuQW5kU3luY0NhcmRzKCkge1xuICAgIGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgIGlmIChhY3RpdmVGaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGFjdGl2ZUZpbGUpO1xuICAgICAgY29uc3QgY2FyZHMgPSB0aGlzLnBhcnNlQ2FyZHNGcm9tQ29udGVudChjb250ZW50KTtcbiAgICAgIGNvbnNvbGUubG9nKCdGb3VuZCBjYXJkczonLCBjYXJkcyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuYWRkTm90ZVRvQW5raShjYXJkLmZyb250LCBjYXJkLmJhY2spO1xuICAgICAgICAgIG5ldyBOb3RpY2UoYEFkZGVkIGNhcmQ6ICR7Y2FyZC5mcm9udH1gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKGBGYWlsZWQgdG8gYWRkIGNhcmQ6ICR7Y2FyZC5mcm9udH0uIEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbmV3IE5vdGljZSgnTm8gYWN0aXZlIGZpbGUnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBhZGROb3RlVG9BbmtpKGZyb250OiBzdHJpbmcsIGJhY2s6IHN0cmluZykge1xuICAgIGNvbnN0IG5vdGUgPSB7XG4gICAgICBkZWNrTmFtZTogXCJEZWZhdWx0XCIsXG4gICAgICBtb2RlbE5hbWU6IFwiQmFzaWNcIixcbiAgICAgIGZpZWxkczoge1xuICAgICAgICBGcm9udDogZnJvbnQsXG4gICAgICAgIEJhY2s6IGJhY2tcbiAgICAgIH0sXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGFsbG93RHVwbGljYXRlOiBmYWxzZSxcbiAgICAgICAgZHVwbGljYXRlU2NvcGU6IFwiZGVja1wiXG4gICAgICB9LFxuICAgICAgdGFnczogW1wib2JzaWRpYW4tc3luY1wiXVxuICAgIH07XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuaW52b2tlQW5raUNvbm5lY3QoJ2FkZE5vdGUnLCB7IG5vdGUgfSk7XG4gICAgaWYgKHJlc3BvbnNlLmVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzcG9uc2UucmVzdWx0O1xuICB9XG5cbiAgYXN5bmMgaW52b2tlQW5raUNvbm5lY3QoYWN0aW9uOiBzdHJpbmcsIHBhcmFtcyA9IHt9KSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cDovL2xvY2FsaG9zdDo4NzY1Jywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGFjdGlvbiwgdmVyc2lvbjogNiwgcGFyYW1zIH0pXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZUpzb246IEFua2lDb25uZWN0UmVzcG9uc2UgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgcmV0dXJuIHJlc3BvbnNlSnNvbjtcbiAgfVxuXG4gIHBhcnNlQ2FyZHNGcm9tQ29udGVudChjb250ZW50OiBzdHJpbmcpOiBBcnJheTx7ZnJvbnQ6IHN0cmluZywgYmFjazogc3RyaW5nfT4ge1xuICAgIGNvbnN0IGNhcmRSZWdleCA9IC8tICguKj8pOjooLio/KSAoPz1cXG4tICguKj8pOjp8JCkvZztcbiAgICBjb25zdCBjYXJkcyA9IFtdO1xuICAgIGxldCBtYXRjaDtcblxuICAgIHdoaWxlICgobWF0Y2ggPSBjYXJkUmVnZXguZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcbiAgICAgIGNhcmRzLnB1c2goe1xuICAgICAgICBmcm9udDogbWF0Y2hbMV0udHJpbSgpLFxuICAgICAgICBiYWNrOiBtYXRjaFsyXS50cmltKClcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYXJkcztcbiAgfVxufSJdfQ==