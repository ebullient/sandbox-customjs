<%* const { Dated } = await window.cJS();
const result = Dated.monthly(tp.file.title);
await tp.file.move(result.dates.monthFile);
-%><% result.header %>

<% result.yearEmbed %>

> [!charm] Affirmations
> %% write these in present tense. Use positive words %%
> 

## Goals


## 🤓 Weekly review
<%* const monday = result.dates.firstMonday;
  var month = monday.month();
  while(month === monday.month()) {
    var weekStart = monday.format("YYYY-MM-DD");
    var weekFile = Dated.weeklyFile(monday, monday);
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

- Review / Update [ELS IDP](https://docs.google.com/document/d/14cENygECfmioPNWA5xiBenF_9hM6FoofrOINlrtOKak/edit)

### 🎉 This month's wins
1. .
2. . 
3. . 

### 🙌 Insights gained
1. .
2. .
3. .
