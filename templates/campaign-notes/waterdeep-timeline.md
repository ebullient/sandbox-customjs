<%*
const categories = ['heist', 'party', 'npc', 'enemy','waterdeep','faerun'];
const category = await tp.system.suggester(categories, categories);
const date = await tp.system.prompt("Enter date", "1499-xx-xx-01");
const title = await tp.system.prompt("Enter title");
const desc = await tp.system.prompt("Add description / note");
-%>
<span data-date='<% date %>' data-category='<% category %>' data-name='<% title %>'><% desc %></span>
