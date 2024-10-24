<%*  
    const { Campaign } = window.customJS;
    const result = await Campaign.prevNext(tp);
    console.log(result)
    tR += `![invisible-embed](${result.prevFile}#Summary)`; 
%>