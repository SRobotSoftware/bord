#!/usr/bin/env node
const chalk = require('chalk')
const fs = require('fs')
const firstBy = require('thenby')
const os = require('os')
const { join } = require('path')

const log = console.log
const storagePath = join(os.homedir(), '.bord')
const storageFile = join(storagePath, 'data.json')

if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath)
if (!fs.existsSync(storageFile)) fs.writeFileSync(storageFile, JSON.stringify({ index: 0, tasks: [] }), 'utf8')
const data = JSON.parse(fs.readFileSync(storageFile, 'utf8'))


function newTask(description, board, priority) {
  const task = {
    id: data.index += 1,
    board,
    description,
    priority,
    checked: false,
  }
  data.tasks.push(task)
}

function findTask(taskId) {
  return data.tasks.find(task => task.id == taskId)
}

function checkTask(taskId) {
  const task = findTask(taskId)
  task.checked = !task.checked
}

function prioritizeTask(taskId, priority) {
  const task = findTask(taskId)
  task.priority = priority
}

function describeTask(taskId, description) {
  const task = findTask(taskId)
  task.description = description
}

function moveTask(taskId, board) {
  const task = findTask(taskId)
  task.board = board
}

function deleteTask(taskId) {
  const spliceIndex = data.tasks.findIndex(x => x.id == taskId)
  if (spliceIndex >= 0) data.tasks.splice(spliceIndex, 1)
}

function deleteBoard(board) {
  data.tasks = data.tasks.filter(task => task.board != board)
}

function findBoards() {
  return data.tasks.reduce((boards, task) => {
    const board = task.board
    if (boards.hasOwnProperty(board)) boards[board].push(task)
    else boards[board] = [task]
    return boards
  }, {})
}

function priorityToString(priority) {
  return (priority >= 3) ? '!!' : (priority >= 2) ? '! ' : '  '
}

function leftPad(number, padTarget) {
  return `${new Array(Math.max((padTarget + '').length - (number + '').length, 0)).fill(0).join('')}${number}`
}

function printTask(taskId) {
  const task = findTask(taskId)
  const text = `${leftPad(task.id, data.index)} ${priorityToString(task.priority)} [${(task.checked) ? 'X' : ' ' }] ${task.description}`
  if (task.checked) log(chalk.green(text))
  else {
    if (task.priority >= 3) log(chalk.redBright(text))
    else if (task.priority >= 2) log(chalk.yellowBright(text))
    else log(chalk.blueBright(text))
  }
}

function printTasks(board) {
  log(chalk.cyan(
`Bord
---
`
  ))
  const boards = findBoards()
  const boardNames = Object.keys(boards)

  boardNames.forEach(board => {
    log(chalk.magenta.bold(`@${board}`))
    boards[board]
      .filter(x => !x.checked)
      .sort(firstBy(v => v.priority, -1)
      .thenBy('id'))
      .forEach(task => printTask(task.id))
    log(chalk.cyan('---'))
    boards[board]
      .filter(x => x.checked)
      .sort(firstBy(v => v.priority, -1)
      .thenBy('id'))
      .forEach(task => printTask(task.id))
    log(chalk.underline.cyan(
`
Completed Tasks: ${boards[board].filter(x => x.checked).length} | Pending: ${boards[board].filter(x => !x.checked).length} | Total: ${boards[board].length}

`
    ))
  })
}

function boardTaskIds(boards, func, args = []) {
  boards.forEach(board => data.tasks
    .filter(task => task.board === board)
    .forEach(task => func(task.id, ...args)))
}

const boardTest = /(?:^|,)\@(\w+)/g
const taskTest = /(?:^|\,)(\d+)/g
const priorityTest = /p:([1-3])$/
const str = process.argv.slice(3)
const command = process.argv[2]
const priority = priorityTest.exec(str)
const foundBoards = []
const foundTasks = []
for(let boardMatch = boardTest.exec(str); boardMatch; boardMatch = boardTest.exec(str)) {
  foundBoards.push(boardMatch[1])
}
for (let taskMatch = taskTest.exec(str); taskMatch; taskMatch = taskTest.exec(str)) {
  foundTasks.push(taskMatch[1])
}

if (command)
switch(command) {
  case 'task':
  case 't':
    const taskTargetBoard = (process.argv[3] && boardTest.test(process.argv[3])) ? process.argv[3].slice(1) : null
    const taskDescTargetTrimmed = (taskTargetBoard) ? process.argv.slice(4) : process.argv.slice(3)
    const taskDescPriorityTrimmed = (priority) ? taskDescTargetTrimmed.slice(0, -1) : taskDescTargetTrimmed
    newTask(Array.isArray(taskDescPriorityTrimmed) ? 'Hello World' : taskDescPriorityTrimmed, taskTargetBoard || 'tasks', (priority) ? priority[1] : 1)
    break
  case 'delete':
  case 'd':
    foundBoards.forEach(board => deleteBoard(board))
    foundTasks.forEach(taskId => deleteTask(taskId))
    break
  case 'check':
  case 'c':
    boardTaskIds(foundBoards, checkTask)
    foundTasks.forEach(taskId => checkTask(taskId))
    break
  case 'move':
  case 'm':
    let targetBoard = foundBoards.pop()
    boardTaskIds(foundBoards, moveTask, [targetBoard])
    foundTasks.forEach(taskId => moveTask(taskId, targetBoard))
    break
  case 'edit':
  case 'e':
    const editTaskTarget = (process.argv[3] && taskTest.test(process.argv[3])) ? process.argv[3] : null
    const editTaskDescription = (editTaskTarget) ? process.argv.slice(4) : null
    if (editTaskTarget) describeTask(editTaskTarget, (priority) ? editTaskDescription.slice(0,-1) : editTaskDescription)
    if (priority) prioritizeTask(editTaskTarget, priority[1])
    break
  case 'prioritize':
  case 'p':
    if (!priority) break
    boardTaskIds(foundBoards, prioritizeTask, priority[1])
    foundTasks.forEach(taskId => prioritizeTask(taskId, [priority[1]]))
    break
  case 'help':
  case 'h':
    log(chalk.green(
`
Bord Help
---

bord
      Displays all tasks on all boards
      USAGE: bord

(t)ask {@board OPTIONAL} '{task description}' {p:[1-3] priority OPTIONAL}
      Adds a new task
      USAGE: bord task @shopping 'milk' p:2

(c)heck {@board or multiple # task ID numbers}
      Inverts the checkbox on one or more tasks or boards
      USAGE: bord check 2 42 54

(m)ove {@board or mutliple # task ID Numbers} {@board destination}
      Moves one or more tasks or boards to a target board
      USAGE: bord move 2 42 @shopping @stuffToDoLater

(e)dit {# task ID Number} '{task description}' {p:[1-3] priority OPTIONAL}
      Edits the description of a target task
      USAGE: bord edit 2 'bread' p:1

(p)rioritize {@board or multiple # task ID numbers} {p:[1-3] priority}
      Changes priority of one or more tasks or boards
      USAGE: bord prioritize @shopping p:3

(d)elete {@board or multiple # task ID numbers}
      Deletes one or more tasks or boards
      USAGE: bord delete @importantThings

(h)elp
      This
      USAGE: bord h
`
    ))
    process.exit(0)
    break
  default:
    log('Command not recognized')
    process.exit(1)
}
printTasks()

fs.writeFileSync(storageFile, JSON.stringify(data), 'utf8')
process.exit(0)
