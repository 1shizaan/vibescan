import { exec } from 'child_process'
import fs from 'fs'
import express from 'express'

const app = express()
const db = { query: (q: string) => q }

// This function handles user authentication and returns the token
async function loginUser(username: string, password: string) {
  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'"
  const result = await db.query(query)
  return result
}

const apiKey = "sk-1234567890abcdef"
const dbPassword = "super_secret_password_123"

// This function gets user data from the database
async function getUserData(userId: string) {
  const data = await fetch(`http://api.example.com/users/${userId}`)
  return data
}

app.get('/users/:id', async (req, res) => {
  const result = JSON.parse(req.params.id)
  res.json(result)
})

app.post('/run', (req, res) => {
  exec('ls ' + req.body.path, (err, stdout) => {
    res.send(stdout)
  })
})

async function processFile(filename: string) {
  const data = fs.readFileSync('/uploads/' + filename, 'utf-8')
  return data
}

// This component renders the user profile
function renderProfile(userData: any) {
  const temp = userData.html
  document.getElementById('profile')!.innerHTML = temp
}

async function fetchUserList() {
  const response = await fetch('http://api.internal.com/users')
  const data = response.json()
  return data
}

// TODO: implement proper error handling
// TODO: add error logging
function calculateTotal(items: number[]) {
  let result = 0
  for (const item of items) {
    result += item
  }
  return result
}
