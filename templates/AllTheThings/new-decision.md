---
<%* const { Templates, AreaRelated, Utils } = await window.cJS();
const title = await tp.system.prompt("Enter Name");
const lower = Utils.lowerKebab(title);
const folder = await Templates.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);
await tp.file.move(`${folder}/${lower}`);

const role = await AreaRelated.chooseRole(tp);
tR += `aliases: ["${title}"]`;
%>
type: decision
role: <%role %>
---
# <% title %>

## Tasks
- [ ] Fire drill analysis: Run through all elements within a timebox (simple: a few minutes, complex a few hours) to create a overview. 

## Decision (PrOACT)

### 1. What is the decision [Pr]oblem?
%% What do I have to decide? What specific decisions to I have to make as part of the broad decision? [Problem](athenaeum/method/goals/smart-choices-a-practical-guide.md#Problem)%%

### 2. What are my fundamental [O]bjectives?
%% Have I asked why enough times to get to bedrock wants and needs? [Objectives](athenaeum/method/goals/smart-choices-a-practical-guide.md#Objectives)%%

### 3. What are my [A]lternatives?
%% Can I think of more that are good/distinct? [Alternatives](athenaeum/method/goals/smart-choices-a-practical-guide.md#Alternatives)%%

### 4. What are the [C]onsequences?
%% What are the consequences of each alternative in terms of the achievement of each of my objectives? Can any alternatives be safely eliminated? [Consequences](athenaeum/method/goals/smart-choices-a-practical-guide.md#Consequences) %%

### 5. What are the [T]rade-offs among my important objectives?
%% Where do conflicting objectives concern me the most? [Tradeoffs](athenaeum/method/goals/smart-choices-a-practical-guide.md#Tradeoffs)%%

### 6. Do any uncertainties pose serious problems?
%% If so, which ones? How do they impact consequences? [Uncertainty](athenaeum/method/goals/smart-choices-a-practical-guide.md#Uncertainty)%%

### 7. How much risk?
%% How good and bad are the various possible consequences? What are ways of reducing my risk? [Risk Tolerance](athenaeum/method/goals/smart-choices-a-practical-guide.md#Risk%20Tolerance)%%

### 8. Have I thought ahead, planning out into the future?
%% Can I reduce my uncertainties by gathering information? What are the potential gains and costs in time, money, and effort? [Linked Decisions](athenaeum/method/goals/smart-choices-a-practical-guide.md#Linked%20Decisions)%%

### 9. Is the decision obvious or pretty clear at this point?
%% What reservations do I have about deciding now? In what ways could the decision be improved by a modest amount of added time and effort? %%


### 10. What should I be working on?
%% If the decision isn't obvious, what do the critical issues appear to be? What facts and opinions would make my job easier? %%



## References
- [Smart Choices: A Practical Guide](athenaeum/method/goals/smart-choices-a-practical-guide.md) : https://read.amazon.com/?asin=B00WDDOSD2&language=en-US


## Log