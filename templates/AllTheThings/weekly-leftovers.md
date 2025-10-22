<%* const { Dated } = await window.cJS();
    const result = Dated.weekly(tp.file.title);

    var incompleteTasks = '';
    const lastWeek = await tp.file.find_tfile(result.lastWeekFile);
    if(lastWeek) { 
        const content = await tp.app.vault.cachedRead(lastWeek); 
        incompleteTasks = content.split('\n')
                    .filter(Dated.filterLeftoverTasks)
                    .join('\n'); 
    }
    if(incompleteTasks) {%>
**Leftovers**
<% incompleteTasks %>
<%*}%>
