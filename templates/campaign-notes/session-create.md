---
<%* 
const { Campaign } = window.customJS;
const folder = await Campaign.chooseFolder(tp, tp.file.folder(true));
const result = await Campaign.nextSession(tp, 3, folder);
console.log(result);
await tp.file.move(`${folder}/${result.nextName}`);
const span = 'span>'
tR += 'tags:' %>
- timeline
- <% result.tag %>/events/pc
played:
---
# Session <% next %>: ...
%%prevnext%%

## Summary
<<% span %> data-date='1499-xx-xx-00' data-category='<% result.tag %>' data-name="..."></<% span %>

---

## Housekeeping


## Recap

<%* tR += (result.prev ? `![invisible-embed](${result.prevFile}#Summary)` : ''); %>

## Onward... 
%%
- **Objective** single sentence: what is this session about?
- **Twist** some fact that adds depth/complexity to the objective.
- **Opposition** (who/what, motivation)
%%

### The Party

### NPCs

### Strong start

%% Kick off the session: What is happening? What's the point? What seed will move the story forward? Where is the action? (start as close to the action as you can) %%

### Potential Scenes

- [ ] .
    ```ad-scene
    collapse: closed
    ```
- [ ] .
    ```ad-scene
    collapse: closed
    ```
- [ ] .
    ```ad-scene
    collapse: closed
    ```

### Secrets and Clues

%% 10! single sentence containing previously unknown information that matters to PCs. Discovery will be improvised. Not all will be. Secrets are only real once they are shared. %%

1. [ ]   
2. [ ]   
3. [ ]   
4. [ ]   
5. [ ]   
6. [ ]   
7. [ ]   
8. [ ]   
9. [ ]   
10. [ ]   

### Loot

- [ ] 
- [ ] 

## Log / Detail
