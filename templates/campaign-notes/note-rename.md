<%* const { Campaign } = window.customJS;
const title = await tp.system.prompt("Enter Name", tp.file.title);
const lower = Campaign.toFileName(title);
const folder = await Campaign.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);
await tp.file.move(`${folder}/${lower}`);
-%>