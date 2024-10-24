<%* const agenda = await tp.file.find_tfile('Agenda');
    const content = await app.vault.cachedRead(agenda); 
    let list = "";
    let last = "00";
    content.split('\n').forEach(item => {
        const itemMatch = item.match(/- \[ \] (\d+:\d+)/);
        if (itemMatch == null) {
            return;
        }
        // console.log(item, itemMatch.at(1), last <= itemMatch.at(1));
        if (last > itemMatch.at(1)) {
            return;
        }
        list += item + "\n";
        last = itemMatch.at(1);
    });
    if(list) {%>
**Agenda**
<% list %>
<%*}%>