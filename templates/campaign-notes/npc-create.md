---
<%* const { Campaign } = window.customJS;
const title = await tp.system.prompt("Enter Name");
const lower = Campaign.toFileName(title);
const folder = await Campaign.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);

await tp.file.move(`${folder}/${lower}`);

// get all tags once
const allTags = Campaign.allTags();
const groupTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'group');
const placeTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'place/');
const regionTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'region/');

const campaign = folder.contains("witchlight")
    ? 'witchlight'
    : 'heist';

const tags = 'tags: ';
let moretags = '';
if ( placeTag ) {
    moretags += `\n- ${placeTag}`;
}
if ( groupTag ) {
    moretags += `\n- ${groupTag}`;
}
if ( regionTag ) {
    moretags += `\n- ${regionTag}`;
}
console.log(tags);
const jsengine = 'js-engine';
const aliases = `aliases: ["${title}"]`;
-%>
<% aliases %>
<% tags %>
- type/npc
- <% campaign %>/iff/unknown
- <% campaign %>/npc/alive<% moretags %>
---
# <% title %>
<span class="subhead">{{primary location}}</span>

TL;DR description / personality / motivation

> [!npc] <% title %>
> *{{gender}} {{race}} {{role/occupation}}, {{alignment}}*  
> - **Trait**
> - **Ideal**
> - **Bond**
> - **Flaw**
^npc

<span class="nav">[Details](#Details) [Relationships](#Relationships) [Secrets](#Secrets) [Related](#Related)</span>

## Details


## Relationships

**Organization or Faction**

## Secrets

## References

```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.linked(engine);
```
