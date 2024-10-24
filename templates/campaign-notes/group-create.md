---
<%* const { Campaign } = window.customJS;
const title = await tp.system.prompt("Enter group name");
const lower = Campaign.toFileName(title);
console.log(title, lower);
await tp.file.rename(lower);
// get all tags once
const allTags = Campaign.allTags();
const group = await Campaign.chooseTag(tp, allTags, 'group/', 'group');
const typeTag = await Campaign.chooseTag(tp, allTags, 'type/group', 'type/group');

const groupTag = `${group}/${lower}`;

const tags = 'tags:';
const jsengine = 'js-engine';
const aliases = `aliases: ["${title}"]`;
-%>
<% aliases %>
<% tags %>
- <% groupTag %>
- <% typeTag %>
---
# <% title %>
<span class="subhead">{{short description}}</span>

TL;DR 

**Beliefs**

1. ..
2. ..
3. ..

More...

- **Alignment** 
- **Allegiances** 
- **Enemies** 


<span class="nav">[Locations](#Locations) [NPCs](#NPCs) [History](#History) [References](#References)</span>

## Locations

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.itemsForTag(engine, '#<% groupTag %>', 'location');
```

## NPCs

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.itemsForTag(engine, '#<% groupTag %>', 'npc');
```

## History

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.logs(engine,'#<% groupTag %>'));
```

## References

