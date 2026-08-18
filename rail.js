// rail.js — theory/instructions slide-out toggle. Same mechanism as the
// "Lessons" rail in VormSubs/src/courses/lofiwebtutorial (plain
// classList.add/remove('open'), no framework).

document.getElementById('railToggle').addEventListener('click', function () {
  document.getElementById('rail').classList.add('open');
});
document.getElementById('railClose').addEventListener('click', function () {
  document.getElementById('rail').classList.remove('open');
});
