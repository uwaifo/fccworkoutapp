const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

app.use(function middleware(req, res, next) {
    console.log(req.method + ' ' + req.path + ' - ' + req.ip)
    next();
});

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

//create user schema and user table
var userTableSchema = new mongoose.Schema({
    "username": String
});
var ExerciseUserTable = mongoose.model("ExerciseUser", userTableSchema);


//create exercise schema and exercise table
var ExerciseDetailsSchema = new mongoose.Schema({
    description: String,
    duration: Number,
    date: Date,
    userId: String
});

var ExerciseDetailsTable = mongoose.model("ExerciseDetails", ExerciseDetailsSchema);


app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


app.use(express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});

//create user and return object with username and id
app.post('/api/exercise/new-user', function (req, res, next) {
    const username = req.body.username;
    //const userId = generateUniqueId(7);   
    ExerciseUserTable.findOne({ "username": username }, function (err, datauser) {
        //check if username exists first
        if (datauser) {
            res.send("This username is already taken")
        } else {

            //saving username and id in db in order to be able to get it after          
            const newUsernameAndId = new ExerciseUserTable({
                "username": username
            });

            newUsernameAndId.save();

            console.log(newUsernameAndId);
            res.json({ "username": newUsernameAndId.username, "Id": newUsernameAndId._id });
        }
    });
});


//get all users and return an array with username and id for each user
app.get('/api/exercise/users', function (req, res) {
    ExerciseUserTable.find({}, function (error, users) {
        if (error)
            console.log('Cannot find users');
        else {
            var responses = users.map(UserMap);
            res.send(responses);
        }
    });
});

// function to get username and userid only
function UserMap(user) {
    return {
        _id: user._id,
        username: user.username
    }
}


//add exercise to any user
app.post('/api/exercise/add', function (req, res) {
    const username = req.body.username;
    const userId = req.body.userId;
    const description = req.body.description;
    const duration = req.body.duration;
    const requiredFieldsToComplete = userId && description && duration;

    if (requiredFieldsToComplete) {
        var user = ExerciseUserTable.findById(userId, function (error, user) {
            if (error) {
                res.send(error);
            }
            if (user) {
                const date = (req.body.date) ? new Date(req.body.date) : new Date();
                const newExercise = {
                    description: description,
                    duration: duration,
                    date: date,
                    userId: userId
                };

                const newExerciseDetails = new ExerciseDetailsTable(newExercise);

                newExerciseDetails.save();

                res.json({
                    description: newExerciseDetails.description,
                    duration: newExerciseDetails.duration,
                    date: newExerciseDetails.date,
                    userId: newExerciseDetails.userId,
                    username: user.username

                });

            }
        });

    } else {
        res.send("Please complete Required fields!")
    }
});

//get user's full erxercise log or part of a log and return user object
//with an array of log and count(exercises count)

app.get('/api/exercise/log', function (req, res) {
    var userId = req.query.userId;
    var from = req.query.from;
    var to = req.query.to;
    var limit = req.query.limit;

    if (!userId) res.send("No user ID specified and is required");
    if (!from) from = "1970-01-01";
    if (!to) to = "2200-12-30";
    if (!limit || limit < 1) {
        limit = 9999999999999;
    } else {
        limit = parseInt(limit);
    }

    ExerciseUserTable.findById(userId, function (error, user) {
        if (error) {
            res.send(error);
        }
        if (user) {
            ExerciseDetailsTable.find({ userId: userId }, function (error, details) {
                if (error) {
                    console.log(error);
                    console.log('error')
                } else {
                    var mappedDetails = details.map(DetailsMapper);

                    res.json({
                        userId: user._id,
                        username: user.username,
                        logs: mappedDetails,
                        count: details.length
                    }
                    );
                }
            })
            .and({ date: { $gte: new Date(from) } })
            .and({ date: { $lte: new Date(to) } })
            .limit(limit);
        }
    })
});


function DetailsMapper(detail) {
    return {
        description: detail.description,
        duration: detail.duration,
        date: detail.date
    }
}


// Not found middleware
app.use((req, res, next) => {
    return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
        .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
});