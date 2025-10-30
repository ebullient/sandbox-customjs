<%* const { Dated } = await window.cJS();
    const result = Dated.daily(tp.file.title);
    await tp.file.move(result.dailyFile);
    const today = result.dates.day.isoWeekday();
    const copingCard = window.simpleFlashcards?.api
        ? window.simpleFlashcards.api.embedCard()
        : "";
    const journalLink = `[📖 ✍️](chronicles/journal/${result.dates.day.format("YYYY[/journal-]YYYY-MM-DD")}.md)`;
-%><% result.header %>
%% %%

<% copingCard %>

%% %%
> [!charm] Journaling
> - *What’s working right now?*
> - *What am I actually looking forward to today?*
> - *Affirmation of the day*
^daily-am

%% agenda %%

<%* if (1 <= today && today <= 5 ) { -%>
**Top Priority**

1. .
2. .
3. .

---

## ❧ Day Planner
%%
- 🎉 Focused for the entire time block
- 🎠 Got a little distracted
%%

### ❧ Morning

- [ ] 06:40 Kids to the bus
- [ ] 07:15 Meditation / Mindfulness
- [ ] 07:30 Reflection / Planning
- [ ] 08:00 Start : GH Notifications / Email
- [ ] 08:45 BREAK / chat
- [ ] 09:00 Start :
- [ ] 09:45 BREAK / chat
- [ ] 10:00 Start :
- [ ] 10:45 BREAK / Sudo
- [ ] 11:00 Start :
- [ ] 11:45 Lunch

### ❧ After Lunch

- [ ] 12:00 Start :
- [ ] 12:45 BREAK / chat
- [ ] 13:00 Start :
- [ ] 13:45 BREAK / chat

### ❧ Afternoon

- [ ] 14:00 Start :
- [ ] 14:45 BREAK / chat
- [ ] 15:00 Start :
- [ ] 15:45 BREAK / chat
- [ ] 16:00 Start :
- [ ] 16:45 BREAK / chat

### ❧ Wrap up

- [ ] 17:00 Preview tomorrow's Agenda
- [ ] 17:30 Reflection
- [ ] 18:00 END
<%* } -%>

---

> [!charm] Journaling
> - *Today's highlight*
> - *Insight of today*
^daily-pm

## Log
- <% journalLink %>
