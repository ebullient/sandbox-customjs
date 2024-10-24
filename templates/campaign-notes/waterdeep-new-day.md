---
<%*
const { Campaign } = window.customJS;
const initial = await Campaign.nextHarptosDay(tp);
const dateString = await tp.system.prompt("Enter date", initial.date);
const result = Campaign.harptosDay(dateString);
console.log(initial, result);
await tp.file.rename(result.filename);
const jsengine = 'js-engine';
tR += 'tags:' %>
- timeline
- heist/events/npc
sort: <%* result.sort %>
---
# <% result.heading %>

%% weather %%

## Tavern Time

| Rowen | Coral  | KW | Tavern | Result |
|-------|--------|----|--------|--------|
|       |        |    |        |  |
^tavern-time

## NPC Activity

- *Emmek Frewn's mood*: <%* tR += await Campaign.mood() %>

### Bregan D'aerthe
- *Jarlaxle's mood*: <%* tR += await Campaign.mood() %>
- Sea Maiden's Faire: 
<%*
tR += `    - On the docks: ${await Campaign.faire('buskers')}, ${await Campaign.faire('animals')}\n`
if (result.date.day % 2 == 0) {
    tR += '    - No Carnival tonight'
} else {
    tR += '    - Carnival tonight'
}
%>

### Xanathar Guild
- *Xanathar's mood*: <%* tR += `${await Campaign.mood()}, ${await Campaign.mood()}, ${await Campaign.mood()}` %>

### Manshoon's Zhenterim
- *Manshoon's mood*: <%* tR += await Campaign.mood() %>
- *Urstul Floxin's mood*: <%* tR += await Campaign.mood() %>

### The Doom Raiders
- *Davil Starsong's mood*: <%* tR += await Campaign.mood() %>
- *Yagra's mood*: <%* tR += await Campaign.mood() %>
- *Istrid Horn's mood*: <%* tR += await Campaign.mood() %>

## Sessions
```<% jsengine %>
const { Reference } = await window.cJS();
return Reference.log(engine);
```