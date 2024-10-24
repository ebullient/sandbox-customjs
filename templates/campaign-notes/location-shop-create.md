---
<%* const { Campaign } = window.customJS;
const title = await tp.system.prompt("Enter Name");
const lower = Campaign.toFileName(title);
const folder = await Campaign.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);

await tp.file.move(`${folder}/${lower}`);

// get all tags once
const allTags = Campaign.allTags();
const place = await Campaign.chooseTag(tp, allTags, 'place/', 'place');
const placeTag = `${place}/${lower}`;

const typeTag = await Campaign.chooseTag(tp, allTags, 'type/location', 'type/location/shop');
const groupTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'group/');
const regionTag = await Campaign.chooseTag(tp, allTags, 'region/', 'region/sword-coast-north');
console.log(typeTag, groupTag, regionTag, placeTag);

let tags = 'tags:';
tags += `\n- ${typeTag}`;
tags += `\n- ${placeTag}`;
if ( groupTag ) {
    tags += `\n- ${groupTag}`;
}
tags += `\n- ${regionTag}`;

console.log(tags);
const jsengine = 'js-engine';
const aliases = `aliases: ["${title}"]`;
-%>
<% aliases %>
<% tags %>
---
# <% title %>
<span class="subhead">{{shopType}}, {{town}}</span>

TL;DR description

- **Owner**
- **Location**

<span class="nav">[Selling](#Selling) [NPCs](#NPCs) [History](#History)</span>

## Selling


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
