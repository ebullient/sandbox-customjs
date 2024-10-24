```ad-toc
- [January](#January)
- [February](#February)
- [March](#March)
- [April](#April)
- [May](#May)
- [June](#June)
- [July](#July)
- [August](#August)
- [September](#September)
- [October](#October)
- [November](#November)
- [December](#December)
- [Dated](#Dated)
```
<%* const { Dated } = await window.cJS();
    const result = await Dated.yearly(tp.file.title);
    console.log(result);
    await tp.file.move(result.yearFile);
    const year = result.year;
-%><% result.header %>
%% Lookahead for important deadlines in the future %%

<%* for (let i = 0; i < 12; i++) {
    const yearMonth = Dated.monthOfYear(year, i); 
    const MM = String(i + 1).padStart(2, '0'); -%>

## <% yearMonth.month %>
- [Plan for <% yearMonth.month %>](<% yearMonth.monthFile %>)
- .

> [!tip]- Birthdays and Anniversaries
<% result.birthdays[MM] -%>
<%* } -%>

## Dated

```<% result.yearByWeek %>
```
