const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const readline = require('readline');

const db = require('./db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
const prompt = (question) => {
  return new Promise((resolve) => rl.question(question, resolve));
};

// Function to add a user
async function addUser() {
  try {
    const username = await prompt('Enter username: ');
    if (!username) throw new Error('Username cannot be empty.');

    // Check if username already exists
    const userExists = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      });
    });
    if (userExists) throw new Error('Username already exists.');

    const password = await prompt('Enter password: ');
    if (!password) throw new Error('Password cannot be empty.');

    const role = await prompt('Enter role (e.g., admin, user): ');
    if (!role) throw new Error('Role cannot be empty.');

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    console.log(`User ${username} added successfully with role ${role}.`);
  } catch (error) {
    console.error('Error adding user:', error.message);
  } finally {
    rl.close();
    db.close();
  }
}

// Run the script
addUser();