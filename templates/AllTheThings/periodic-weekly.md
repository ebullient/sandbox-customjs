<%* const { Dated } = await window.cJS();
    const result = Dated.weekly(tp.file.title);
    await tp.file.move(result.weekFile);
    const upcoming = await Dated.weeklyEvents(tp.file.title);
    const monday = result.dates.monday.format("YYYY-MM-DD");
    const ghFile = result.weekFile.replace('week', 'gh');
-%>
<% result.header %>

### Goals / Focus

**Habit**:   
**Goal for the week**:   
**I am excited about**:   

**Priorities**:
1. .
2. .
3. .

> [!tldr] Upcoming
<% result.upcoming %>

### Tasks

<% tp.file.include(tp.file.find_tfile("assets/templates/weekly-leftovers.md")) %>

#### Self care

- [ ] [Reflect on last week](<% result.weeklyReflection %>)
<%* if(result.monthlyReflection) {-%>
<% result.monthlyReflection %>
<%*}-%>
- [ ] Update activity rings, review status/progress

#### Maintenance

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
