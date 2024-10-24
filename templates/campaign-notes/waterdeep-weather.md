<%* 
const { Campaign } = window.customJS;
const date = await tp.system.prompt("Month day");
const [month, day] = date.split(' ');
const season = Campaign.faerunSeason(month, day || 1);
console.log(month, day, season);
const weather = await Campaign.weather(season);
const slug = Campaign.toFileName(date);
-%>
> [!weather] Weather on <% date %>
> <% weather %>
^weather-<% slug %>
