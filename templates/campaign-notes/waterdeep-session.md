---
<%*
const { Campaign } = await window.cJS();
const result = await Campaign.nextSession(tp, 3, 'heist/sessions');
console.log(result);
await tp.file.move(`heist/sessions/${result.nextName}`);
const span = 'span>';
tR += 'tags:' %>
- timeline
- heist/events/pc
played:
---
# Session <% result.next %>: ...
%%prevnext%%

## Summary

<<% span %> data-date='1499-Mirtul-xx-01' data-category='heist' data-name="🪕 ..."></<% span %>

---

## Housekeeping


## Recap

<%* tR += `![invisible-embed](${result.prevFile}#Summary)`; %>

## Onward... 

### The Party

> [!mood]- Mood of the party?
> - *Coral's mood*: <%* tR += await Campaign.mood() %>
> - *Nora's mood*: <%* tR += await Campaign.mood() %>
> - *Trollskull mood*: <%* tR += await Campaign.mood() %>

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

### Secrets, Rumors, News, and Clues

%% 10! single sentence containing previously unknown information that matters to PCs. Discovery will be improvised. Not all will be. Secrets are only real once they are shared. %%

- [ ]   
- [ ]   
![secrets-rumors](heist/tables/secrets-rumors.md)

### Loot

- [ ] 
- [ ] 

## Log / Detail
