---
<%* const { AreaRelated, Templates, Utils } = await window.customJS;
const title = await tp.system.prompt("Enter Name");
const lower = Utils.lowerKebab(title);
const folder = await Templates.chooseFolder(tp, tp.file.folder(true));
console.log("new area", title, lower, folder);
await tp.file.move(`${folder}/${lower}`);
const role = await AreaRelated.chooseRole(tp);
const sphere = await AreaRelated.chooseSphere(tp);
tR += `aliases:\n- "${title}"`;
%>
type: area
role: <%role %>
sphere: <%sphere %>
---
# <% title %>

%% What? Description %%

%% How does this align with my passion and interest? %%

```js-engine
const { AreaRelated } = await window.cJS();
return AreaRelated.allRelated(engine);
```

## Tasks
- [ ] Define initial tasks

## ❧ Percolator
%% ideas in flight %%

## ❧ Resources 
%% links, contacts %%

## Log



