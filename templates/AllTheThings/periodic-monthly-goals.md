<%* const { Dated } = await window.cJS();
const result = Dated.monthly(tp.file.title);
await tp.file.move(result.dates.monthFile);
-%><% result.header %>

%% What are your goals for this month?
What practical actions will you be taking to achieve them?
S = Specific (What EXACTLY do you want to accomplish?)  
M = Measurable (How will you measure success?)  
A = Attainable (Is it within your reach?)  
R = Resonant (Do you feel driven to accomplish it?)  
T = Thrilling (Thrilling?)
%%

- ***Focus***:  %% one thing to focus on this month %%
- ***Habit***:  %% one habit to focus on this month %%

<% result.yearEmbed %>

## 🤓 Weekly review
<%* const monday = result.dates.firstMonday;
  var month = monday.month();
  while(month === monday.month()) {
    var weekStart = monday.format("YYYY-MM-DD");
    var weekFile = Dated.weeklyFile(monday, monday);
    var tyiwFile = Dated.tyiwFile(monday);
%>
### <% weekStart %>
- [Plan for the week](<% weekFile %>)

#### 🎉 Big wins 
#### 🎯 How far did I get on my goals?
#### 👩‍🎓 What worked? What didn't?
#### ✨ How should I tweak my strategy next week?


<%* monday.add(7,'d');
}
-%>

## Reflection

### 🎉 This month's wins
1. .
2. . 
3. . 

### 🙌 Insights gained
1. .
2. .
3. .
