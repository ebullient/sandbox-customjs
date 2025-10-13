---
<%* const { AreaRelated, Templates, Utils } = await window.customJS;
const title = await tp.system.prompt("Enter Name");
const lower = Utils.lowerKebab(title);
const folder = await Templates.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);
await tp.file.move(`${folder}/${lower}`);

const role = await AreaRelated.chooseRole(tp);
console.log(role);

tR += `aliases: ["${title}"]`;
%>
type: area
role: <%role %>
---
# <% title %>

%% What? Description %%

%% How does this align with my passion and interest? %%

```js-engine
const { AreaRelated } = await window.cJS();
return AreaRelated.relatedAreas(engine);
```

```js-engine
const { AreaRelated } = await window.cJS();
return AreaRelated.relatedProjects(engine);
```

## Tasks
- [ ] Define initial tasks

## ❧ Percolator
%% ideas in flight %%

## ❧ Resources 
%% links, contacts %%

## Log



