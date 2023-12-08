const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});


// Cookie parser for storing creds
const cookieParser = require('cookie-parser');
app.use(cookieParser());

//*** create form parser
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));

// This sql connection works for joe. Joe use this when working

//*** set up mysql connections
//   var mysql = require('mysql');

//   var con = mysql.createConnection({
//       host: "localhost",
//       user: "root",
//       password: "blubbins",  // use your own MySQL root password
//       database: "wanderlog"
//     });


// This sql connection works for Tre. Tre use this when working

var mysql = require('mysql2');

var con = mysql.createConnection({
host: "localhost",
port: "3306",
user: "root",
password: "Alexemma1",
database: "WanderLog"
});

//*** connect to the database
con.connect(function(err) {
  if (err)
      throw err;
  console.log("Connected to MySQL");
});

//---------------------------------------------------------------------------

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve home.html when /home is accessed
app.get('/home', (req, res) => {

    // get username from cookies
    const username = req.cookies.username;

    // handle case where username is not found
    if (!username) {
        res.status(401).send('Unauthorized');
        return;
    }

    res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

// Serve login.html when /login is accessed
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// Serve landing.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'landing.html'));
});

//---------------------------------------------------------------------------
// Handles post during login
//---------------------------------------------------------------------------
app.post('/login', (req, res) => {
    const name = req.body.name;
    const usr = req.body.usr;
    const pwd = req.body.pwd;

    if (name) {
        // vars for registration queries
        const sqlQueryRegister = "INSERT INTO users (name, username, password) VALUES (?, ?, ?)";
        const values = [name, usr, pwd];

        // send query
        con.query(sqlQueryRegister, values, (err, result) => {
            if (err) {
                console.error('Error registering user:', err);
                res.status(500).send('Internal Server Error');
            } 
            else {
                console.log('User registered successfully.');
                
                // store user information in a cookie or session
                res.cookie('username', usr); 
                
                // redirect back home 
                res.redirect(`http://localhost:3000/home?usr=${usr}`);
            }
        });
    } 
    else {
        // vars for login query
        const sqlQueryLogin = "SELECT username FROM users WHERE username=? AND password=?";
        const values = [usr, pwd];

        // send login query
        con.query(sqlQueryLogin, values, (err, result) => {
            if (err) {
                console.error('Error logging in:', err);
                res.status(500).send('Internal Server Error');
            } 
            else if (result[0]) {
                console.log('User logged in successfully.');
                
                // store user information in a cookie or session
                res.cookie('username', usr);

                // redirect back to home
                res.redirect(`http://localhost:3000/home?usr=${usr}`);
            } 
            else {
                // send error message
                res.status(401).json({ message: "Username or password is incorrect. Please try again, or create an account" });
            }
        });
    }
});


//---------------------------------------------------------------------------
// Hanldes post during travel experience form submission
//---------------------------------------------------------------------------
app.post('/home', (req, res) => {
    
    // extract data from the form submission
    const username = req.cookies.username; 
    const city = req.body.city;
    const country = req.body.country;
    const departureDate = req.body.departureDate;
    const returnDate = req.body.returnDate;
    const notes = req.body.notes;

    // validate that required fields are not null or empty
    if (!city || !country || !departureDate || !returnDate || !notes) {
        return res.status(400).send('Invalid form data. Please fill in all required fields.');
    }

    // Insert the form data into the database
    const sqlQuery = `INSERT INTO visits (username, city, country, depart_date, return_date, notes) VALUES (?, ?, ?, ?, ?, ?)`;

    const values = [username, city, country, departureDate, returnDate, notes]; 

    con.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error inserting data into the database:', err);
            res.status(500).send('Internal Server Error');
        } else {
            console.log('Data inserted into the database successfully.');
            // redirect the user back to the home page
            res.redirect(`http://localhost:3000/home?usr=${username}`);
        }
    });
});

//---------------------------------------------------------------------------
// Hanldes get during world.csg loading
//---------------------------------------------------------------------------
// Add this route to handle fetching visited countries
app.get('/visited-countries', (req, res) => {
    // Get the username from cookies
    const username = req.cookies.username;

    if (!username) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // Query the database to get visited countries for the user
    const sqlQuery = 'SELECT DISTINCT country FROM visits WHERE username = ?';

    con.query(sqlQuery, [username], (err, result) => {
        if (err) {
            console.error('Error fetching visited countries:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            const visitedCountries = result.map(row => row.country);
            res.json({ visitedCountries });
        }
    });
});

// Handles GET requests for user visits to a specific country
app.get('/user-visits', (req, res) => {
    const username = req.query.usr;
    const country = req.query.country;

    // not enough parms to fulfill request
    if (!username || !country) {
        // display error
        res.status(400).json({ error: 'Invalid request parameters' });
        return;
    }

    // query the database to get user visits to the specified country
    const sqlQuery = 'SELECT visit_id, city, depart_date, return_date, notes FROM visits WHERE username = ? AND country = ?';

    // send query
    con.query(sqlQuery, [username, country], (err, result) => {
        if (err) {
            // log errors
            console.error('Error fetching user visits:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } 
        else {
            // build the json response with necessary fields
            const userVisits = result.map(row => ({
                visit_id: row.visit_id,
                city: row.city,
                depart_date: row.depart_date,
                return_date: row.return_date,
                notes: row.notes,
            }));
            res.json({ visits: userVisits });
        }
    });
});

//handles updating a visit's notes
app.post('/update', (req, res) => {
    const visit_id = req.body.visit_id;
    const notes = req.body.notes

    // SQL query to delete specified visit
    const sqlQuery = 'UPDATE visits SET notes = ? WHERE visit_id = ?';

    // Execute the query
    con.query(sqlQuery, [notes, visit_id], (err, result) => {
        if (err) {
            // log errors
            console.error('Error deleting visit:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } 
        else {
            console.log('Data updated successfully.');
        }
    });
});

//handles deleting a visit
app.post('/delete', (req, res) => {
    const visit_id = req.body.data;

    // SQL query to delete specified visit
    const sqlQuery = 'DELETE FROM visits WHERE visit_id = ?';

    // Execute the query
    con.query(sqlQuery, [visit_id], (err, result) => {
        if (err) {
            // log errors
            console.error('Error deleting visit:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } 
        else {
            console.log('Data deleted successfully.');
        }
    });
});


//handles GET requests for wander statistics
app.get('/statistics', (req, res) => {
    const username = req.cookies.username;

    const sqlQuery = 'SELECT statistics FROM (SELECT COUNT(DISTINCT city) AS statistics, 1 AS count FROM visits WHERE username = ? UNION SELECT COUNT(DISTINCT country), 2 FROM visits WHERE username = ? UNION SELECT SUM(DATEDIFF(return_date, depart_date)), 3 FROM visits WHERE username = ? UNION SELECT AVG(DATEDIFF(return_date, depart_date)), 4 FROM visits WHERE username = ? UNION SELECT name, 5 FROM users WHERE username = ?) AS subquery;';

    con.query(sqlQuery, [username,username,username,username,username], (err, result) => {
        if (err) {
            // log errors
            console.error('Error fetching user visits:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
        else {
            // build the json response with necessary fields
            const userStatistics = result.map(row => row.statistics);
            res.json({ statistics: userStatistics });
        }
    });
});