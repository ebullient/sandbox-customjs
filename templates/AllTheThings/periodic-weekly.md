<%* const { Dated } = await window.cJS();
const result = Dated.weekly(tp.file.title);
await tp.file.move(result.weekFile);
const upcoming = await Dated.weeklyEvents(tp.file.title);
const ibmReport = Dated.weeklyWorkReport(result.dates.monday);
console.log(result, upcoming, ibmReport);
const ghFile = result.weekFile.replace('week', 'gh');
-%><% result.header %>

```js-engine-debug
const { TierTracker } = await window.cJS();
return await TierTracker.createGrid(engine);
```

### Goals / Focus

- **Habit**: .  
- **Goal for the week**: .

<%* if (upcoming && upcoming.trim()) { -%>

> [!tldr] Upcoming
<% upcoming %>

<%* } -%>
### Tasks

- [ ] [_IBM_](demesne/ibm/ibm.md): <% ibmReport %>
<% tp.file.include(tp.file.find_tfile("assets/templates/weekly-leftovers.md")) %>
%% self care %%
- [ ] [Reflect on last week](<% result.weeklyReflection %>)
<%* if(result.monthlyReflection) {-%>
<% result.monthlyReflection %>
<%*}-%>
- [ ] Update activity rings, review status/progress
%% maintenance %%
- [ ] Check "missing"
- [ ] Review [All Tasks](all-tasks.md) (priority, next actions, etc)
- [ ] File any [Inbox](Inbox.md) items from last week
- [ ] `qk`  and updates on anduin
- [ ] `qk` and updates on erebor
- [ ] updates on esgaroth
- [ ] updates on commonhus
- [ ] updates on wyrmling
- [ ] check on moria
- [ ] water plants

---

### Project items completed this week:
```<% result.weeklyProjects %>
```

> [!hint] GH Activity  
> ![invisible-embed](<% ghFile %>.md#Contributions%20for%20the%20week)

---

## Logs
<% result.log %>
