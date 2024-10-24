<%* const { Dated } = await window.cJS();
    const result = Dated.weekly(tp.file.title);
    await tp.file.move(result.weekFile);
    const monday = result.dates.monday.format("YYYY-MM-DD");
    const ghFile = result.weekFile.replace('week', 'gh');
-%>
<% result.header %>
%%
- [ ] [Reflect on last week](<% result.weeklyReflection %>)
- [ ] Review [percolator](percolator.md) (priority, next actions, etc)
- [ ] File any [Inbox](Inbox.md) items from last week
<%* if(result.monthlyReflection) {-%>
<% result.monthlyReflection %>
<%*}-%>
%%

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

**Commonhaus**


**Red Hat**


**Other**

- [ ] Run `qk` to update git repos (anduin, erebor)
- [ ] updates on erebor
- [ ] updates on anduin
- [ ] updates on esgaroth
- [ ] check on moria
- [ ] updates on wyrmling
- [ ] Check "missing"
- [ ] water plants

<% tp.file.include(tp.file.find_tfile("assets/templates/weekly-leftovers.md")) %>

---

### Project items completed this week:
```<% result.weeklyProjects %>
```

> [!hint] GH Activity  
> ![invisible-embed](<% ghFile %>.md#Contributions%20for%20the%20week)

---

<% result.log %>
