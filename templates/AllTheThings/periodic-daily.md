<%* const { Dated } = await window.cJS();
    const result = Dated.daily(tp.file.title);
    await tp.file.move(result.dailyFile);
    const today = result.dates.day.isoWeekday();
    const journalLink = `[📖 ✍️](${Dated.dailyJournalFile(result.dates.day)})`;
-%><% result.header %>

%% tier goes here %%

> [!charm] Journaling
> - *What’s working right now?*
> - *What am I actually looking forward to today?*
> - *Affirmation of the day*
^daily-am

%% agenda %%

%%
- 🎉 Completion / Landed the task.
- 🎠 Distracted / chasing novelty.
- 😵‍💫 Tier 2 hyperfocus. Must finish.
- ☄️ Tier 4 hyperfocus. Feels good, costs later. Time for Tier 4 rules.
%%

<%* if (1 <= today && today <= 5 ) { -%>
**Top Priority**

1. .
2. .
3. .

## ❧ Day Planner

### ❧ Morning

- [ ] 06:40 Kids to the bus
- [ ] 07:15 Meditation / Mindfulness
- [ ] 07:30 Reflection / Planning
- [ ] 08:00 Start : GH Notifications / Email
- [ ] 08:50 BREAK / chat
- [ ] 09:00 Start :
- [ ] 09:50 BREAK / chat
- [ ] 10:00 Start :
- [ ] 10:50 BREAK / chat
- [ ] 11:00 Start :
- [ ] 11:50 Lunch

### ❧ After Lunch

- [ ] 12:00 Start :
- [ ] 12:50 BREAK / chat
- [ ] 13:00 Start :
- [ ] 13:50 BREAK / chat

### ❧ Afternoon

- [ ] 14:00 Start :
- [ ] 14:50 BREAK / chat
- [ ] 15:00 Start :
- [ ] 15:50 BREAK / chat
- [ ] 16:00 Start :
- [ ] 16:50 BREAK / chat

### ❧ Wrap up

- [ ] 17:00 Preview tomorrow's Agenda
- [ ] 18:00 BREAK
- [ ] 19:30 Reflection
- [ ] 20:00 END
<%* } -%>

> [!charm] Journaling
> - *What [tier](demesne/self/adhd/tier-system/tier-system.md) was I in today?*
> - *Today's highlight*
> - *Insight of today*
^daily-pm

## Log
- <% journalLink %>
