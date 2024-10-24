---
<%* const { Campaign } = window.customJS;
const title = await tp.system.prompt("Enter Name");
const lower = Campaign.toFileName(title);
console.log(title, lower);
await tp.file.rename(lower);

// get all tags once
const allTags = Campaign.allTags();
let regionTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'region/');
let placeTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'place/');
let groupTag = await Campaign.chooseTagOrEmpty(tp, allTags, 'group');
let tags = '';
if ( placeTag || groupTag || regionTag ) {
  tags = '\ntags:';
  if ( regionTag ) {
    tags += `\n- ${regionTag}`;
  }
  if ( placeTag ) {
    tags += `\n- ${placeTag}`;
  }
  if ( groupTag ) {
    tags += `\n- ${groupTag}`;
  }
}
console.log(tags);
const aliases = `aliases: ["Encounter: ${title}"]`;
-%>
<% aliases %>
encounter: new<% tags %>
---
# <% title %>
%% Abstract %%

## Ideas
- .

## Main NPCs