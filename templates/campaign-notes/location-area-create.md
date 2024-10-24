---
<%* const { Campaign } = window.customJS;
const title = await tp.system.prompt("Enter Name");
const lower = Campaign.toFileName(title);
const folder = await Campaign.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);

await tp.file.move(`${folder}/${lower}`);

// get all tags once
const allTags = Campaign.allTags();
const typeTag = await Campaign.chooseTag(tp, allTags, 'type/area', 'type/area');
const groupTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'group/');
const regionTag = await Campaign.chooseTag(tp, allTags, 'region/', 'region');

const placeTag = `${regionTag}/${lower}`
console.log(typeTag, groupTag, regionTag, placeTag);

let tags = 'tags:';
tags += `\n- ${typeTag}`;
tags += `\n- ${placeTag}`;
if ( groupTag ) {
    tags += `\n- ${groupTag}`;
}
tags += `\n- ${regionTag}`;

const jsengine = 'jsengine';
const aliases = `aliases: ["${title}"]`;
-%>
<% aliases %>
<% tags %>
---
# <% title %>
<span class="subhead">{{townSize}}, {{context}}</span>

TL;DR description

- **Population**
- **Government**

<span class="nav">[Places](#Places) [NPCs](#NPCs) [History](#History)</span>

## Locations

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.itemsForTag(engine, '#<% placeTag %>', 'location');
```

## NPCs

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.itemsForTag(engine, '#<% placeTag %>', 'npc');
```

## History

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.logs(engine,'#<% placeTag %>'));
```
