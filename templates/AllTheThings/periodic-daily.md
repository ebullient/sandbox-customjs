<%* const { Dated } = await window.cJS();
    const result = Dated.daily(tp.file.title);
    await tp.file.move(result.dailyFile);
    const today = result.dates.day.isoWeekday();
-%><% result.header %>
**Goals for today** 
- .

<%* if (1 <= today && today <= 5 ) { -%>
%% agenda %%

## Day Planner
%%
- 🎉 Focused for the entire time block
- 🎠 Got a little distracted
%%
### Morning
- [ ] 06:50 Kids to the bus
- [ ] 07:30 Reflection / Planning
- [ ] 08:00 Start : GH Notifications / Email
- [ ] 08:45 BREAK / chat
- [ ] 09:00 Start :
- [ ] 09:45 BREAK / chat
- [ ] 10:00 Start : 
- [ ] 10:45 BREAK / Sudo
- [ ] 11:00 Start : 
- [ ] 11:45 Lunch

### After Lunch
- [ ] 12:30 Meditation
- [ ] 12:45 BREAK / chat
- [ ] 13:00 Start : 
- [ ] 13:45 BREAK / chat

### Afternoon
- [ ] 14:00 Start : 
- [ ] 14:45 BREAK / chat
- [ ] 15:00 Start : 
- [ ] 15:45 BREAK / chat
- [ ] 16:00 Start : 
- [ ] 16:45 BREAK / chat

### Wrap up
- [ ] 17:00 Preview tomorrow's Agenda
- [ ] 17:30 Reflection
- [ ] 18:00 END

<%* } else { -%>
%% %%
<%* } -%>

## Log

