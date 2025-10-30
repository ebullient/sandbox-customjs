---
<%* const { Templates, AreaRelated, Utils } = await window.cJS();
const title = await tp.system.prompt("Enter Name");
const lower = Utils.lowerKebab(title);
const folder = await Templates.chooseFolder(tp, tp.file.folder(true));
console.log("new quest", title, lower, folder);
await tp.file.move(`${folder}/${lower}`);
const role = await AreaRelated.chooseRole(tp);
const sphere = await AreaRelated.chooseSphere(tp);
tR += `aliases:\n- "${title}"`;
%>
type: quest
role: <%role %>
sphere: <%sphere %>
---
# <% title %>

- **What**: %% synopsis %%
- **Who**:  %% collaboration %%
- **When**: %% timeline%%
- **Why**: %% internal or external motivation %%

%% How does this align with my passion and interest? %%

## Tasks

- [ ] Define initial tasks

## ❧ Percolator
%% ideas in flight %%

## ❧ Resources
%% links, contacts %%

## Log

