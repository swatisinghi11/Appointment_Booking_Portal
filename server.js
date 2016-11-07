var express =require('express');
var crypto = require('crypto');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var session = require('express-session');
var uuid = require('node-uuid');
var bodyParser = require('body-parser')

var CronJob = require('cron').CronJob;

app.set('ip', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
app.set('port', (process.env.OPENSHIFT_NODEJS_PORT || 8080));

app.use('/public',express.static(__dirname+'/public'));
app.use(session({secret: 'secretKey'}));
app.use(bodyParser.json());

// To handle the user sessions
var user_session;
var user_socket_map={};
var socket_user_map={};

var connection = mysql.createConnection({
   host     : process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
   user     : process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
   password : process.env.OPENSHIFT_MYSQL_DB_PASSWORD || '1234',
   database : 'legistify'
 });
  
connection.connect();


// Creating Tables 
connection.query('create table if not exists users(uuid text, username varchar(255) NOT NULL, lawyer text, email text, password text, firstname text, lastname text, imageId int, details text, UNIQUE(username), PRIMARY KEY (username))', function(err, rows, fields) {
   if (err){
     console.log('Error while performing Query of creating users table');
   }
 });

connection.query('create table if not exists schedule(uuid text, date text, slot_info text, name text)', function(err, rows, fields) {
   if (err){
     console.log('Error while performing Query of creating schedule table');
   }
 });

connection.query('create table if not exists bookings(lawyer_uuid text, site_user_uuid text, date text, time_slot text, status text , lawyer_name text ,site_user_name text )', function(err, rows, fields) {
   if (err){
     console.log('Error while performing Query of createing message table');
   }
 });

connection.query('SELECT * from users', function(err, rows, fields) {
    if (!err)
     console.log('The solution is: ', rows);
    else
     console.log('Error while performing Query.');
});


//Mapping the URL for get and POST requests

app.get('/', function(req, res){
    user_session = req.session;
    if(user_session.user_uuid){
        res.redirect('/mainpage?id='+user_session.user_uuid)
    }
    else{
        res.sendFile(__dirname + '/landingPage.html');
    }
});

app.get('/signin', function(req, res){
    user_session = req.session;
    if(user_session.user_uuid){
        res.redirect('/mainpage?id='+user_session.user_uuid)
    }
    else{
        res.sendFile(__dirname + '/SignIn.html');
    }
});

app.get('/signup', function(req, res){
    user_session = req.session;
    if(user_session.user_uuid){
        res.redirect('/mainpage?id='+user_session.user_uuid)
    }
    else{
      res.sendFile(__dirname + '/SignUp.html');
    }

});

app.post('/lawyer_details', function(req, res){
    var lawyer_details = req.body;
    var update_query = 'update users set details="'+lawyer_details.details+'" where uuid="'+lawyer_details.uuid+'"';
    var response ={};
    connection.query(update_query, function(err, rows, fields) {
        if (!err){
            console.log('User Successfully updated !!!');
            response.success = 1
            response.uuid = lawyer_details.uuid
            res.send(response);

        }
        else{
            console.log('Insert Unsuccessful !!!')
            response.success = -1
            response.error_msg = 'QUERY_PROBLEM'
            res.send(response);
        }
    });   

});

// Login Authentication

app.post('/authentication', function(req, res){
    signin_credentials = req.body;
    var password_hash = crypto.createHash("md5").update(signin_credentials.password).digest('hex')
    var query =  connection.query('select uuid, password from users where username="'+signin_credentials.username+'"');
    var signin_result={success:-1}
    query.on('result', function(row) {
        var hashed_password = row.password
        if(hashed_password == password_hash){
            signin_result.success = 1
            signin_result.username = signin_credentials.username
            signin_result.uuid = row.uuid
            signin_result.remember = signin_credentials.remember
            console.log('Password Matched !!! Logging in...')
        }
        else{
            signin_result.success = 0
            signin_result.username = signin_credentials.username
            signin_result.uuid = row.uuid
            signin_result.remember = signin_credentials.remember
            signin_result.message = 'PASSWORD_DOES_NOT_MATCH'
            console.log('PASSWORD_DOES_NOT_MATCH')   
        }
    });
    query.on('end',function(){
        if(signin_result.success == -1){
            signin_result.username = signin_credentials.username
            signin_result.remember = signin_credentials.remember
            signin_result.message = 'USERNAME_DOES_NOT_EXSITS'
            console.log('USERNAME_DOES_NOT_EXSITS')   
        }
        res.send(signin_result);
    });
});


// Signup Data Update

app.post('/signup_update', function(req, res){
    signup_credentials = req.body;
    var signup_result = {}
    var username_exists =false
    var query =  connection.query('SELECT * from users where username="'+signup_credentials.username+'"');
    query.on('result', function(row) {
        username_exists = true
    });
    query.on('end',function(){
        if(username_exists){
            console.log('username already exists')
            signup_result.success = 0
            signup_result.error_msg = 'USERNAME_EXSITS'
            res.send(signup_result);
        }
        else{
            var imageId = Math.floor(Math.random()*15)+1
            var user_uuid = uuid.v4()
            var password_hash = crypto.createHash("md5").update(signup_credentials.password).digest('hex');
            var insert_query = 'insert into users values("'+user_uuid+'","'+signup_credentials.username+'","'+signup_credentials.lawyer+'","'+signup_credentials.email+'","'+password_hash+'","'+signup_credentials.firstname+'","'+signup_credentials.lastname+'",'+imageId+',"'+'Not Available !!!'+'")'
            connection.query(insert_query, function(err, rows, fields) {
                if (!err){
                    console.log('User Successfully created !!!');
                    signup_result.success = 1
                    signup_result.uuid = user_uuid
                    signup_result.lawyer = signup_credentials.lawyer
                    if(signup_credentials.lawyer == "1"){
                        var curr_date = new Date();
                        var nextday = new Date();
                        nextday.setDate(curr_date.getDate()+1);
                        var date_params = nextday.toString().split(" ");
                        var date = date_params[2]+"-"+date_params[1]+"-"+date_params[3];
                        var lawyerSchedule_credentials = {'uuid':user_uuid,'date':date,'slot_info':'1100-1300:0,1500-1700:0,1900-2100:0','name':signup_credentials.firstname};
                        var insert_query = 'insert into schedule values("'+lawyerSchedule_credentials.uuid+'","'+lawyerSchedule_credentials.date+'","'+lawyerSchedule_credentials.slot_info+'","'+lawyerSchedule_credentials.name+'")'
                        connection.query(insert_query, function(err, rows, fields) {
                            if (!err){
                                console.log('Lawyer schedule Successfully updated !');
                                res.send(signup_result);
                            }
                            else{
                                console.log('Insert Unsuccessful !!!')
                                res.send(signup_result);

                            }
                        });  
                    }
                    else{
                        res.send(signup_result);
                    }

                }
                else{
                    console.log('Insert Unsuccessful !!!')
                    signup_result.success = -1
                    signup_result.error_msg = 'QUERY_PROBLEM'
                    res.send(signup_result);
                }
            });   
        }
    });
});


app.get('/success_user', function(req, res){
    user_session = req.session;

    if(user_session.user_uuid){
        res.redirect('/mainpage?id='+user_session.user_uuid)
    }
    else{
        res.sendFile(__dirname + '/success_user.html');
    }
});

app.get('/success_lawyer', function(req, res){
    user_session = req.session;

    if(user_session.user_uuid){
        res.redirect('/mainpage?id='+user_session.user_uuid)
    }
    else{
        res.sendFile(__dirname + '/success_lawyer.html');
    }
});


app.get('/termsAndPrivacy', function(req, res){
    res.sendFile(__dirname + '/termsAndPrivacy.html');
});


app.get('/mainpage', function(req, res){
    user_session = req.session;
    var query = require('url').parse(req.url,true).query;
    var user_uuid = query.id;
    user_session.user_uuid = user_uuid
    if(user_session.user_uuid){
        res.sendFile(__dirname + '/mainPage.html');
    }
    else{
        res.redirect('/signin');
    }
});

app.get('/logout', function(req, res){
    req.session.destroy(function(err){
        if(err){
            console.log('Error in Logging out',err);
        }
        else
        {
            res.redirect('/');
        }
    });
});


// Connection by scockets
// Listen on various threads and executes the desired fucntion
io.on('connection', function(socket){
    console.log("new user connection")
    // If user is disconnected
    socket.on('disconnect', function(){
        console.log('user disconnected',socket_user_map[socket.id]);
        if(socket.id in socket_user_map){
            disconnected_user_uuid = socket_user_map[socket.id]
            delete user_socket_map[disconnected_user_uuid]
            delete socket_user_map[socket.id]
        }
    });    

    // Process returning all data related to a user when it refreshes the page or first time visits it.
    socket.on('mainpage_initialization', function(user_uuid){
        //Socket added to the list. For online, offline feature
        user_socket_map[user_uuid] = socket
        socket_user_map[socket.id] = user_uuid

        var query =  connection.query('select uuid,firstname,lastname,lawyer,email,imageId from users where uuid="'+user_uuid+'"')
        var user_data = {};
        query.on('result', function(row) {
           user_data.current_user = row;
        });
        query.on('end',function(){
            if (user_data.current_user.lawyer=="0"){
            var all_lawyer = []
            var query =  connection.query('select uuid,username,firstname,lastname,lawyer,email,imageId,details from users where lawyer="1"')
            query.on('result', function(row) {
               all_lawyer.push(row) 
               });

            query.on('end',function(){
                user_data.lawyer_list = all_lawyer
                socket.emit('mainpage_initialization',user_data);
            });  

            }
            else if(user_data.current_user.lawyer=="1"){
                    var query= connection.query('select uuid,date,slot_info,name from schedule where uuid="'+user_uuid+'"')
                    query.on('result', function(row) {
                       user_data.lawyer_schedule = row
                    });

                    query.on('end',function(){
                        var appointment_request_list = []
                        var query= connection.query('select lawyer_uuid,site_user_uuid,date,time_slot,status,lawyer_name,site_user_name from bookings where lawyer_uuid="'+user_uuid+'"')
                        query.on('result', function(row) {
                            appointment_request_list.push(row)
                        });

                        query.on('end',function(){
                            user_data.appointment_request_list = appointment_request_list
                            socket.emit('mainpage_initialization',user_data);

                        });  
                    });  
            }
            
            
        });
    });

    // Returns the all lawyer related information requested by client.
    socket.on('lawyer_information',function(user_ids){
        var lawyer_uuid = user_ids.lawyer_uuid;
        var user_uuid = user_ids.user_uuid;
        var query= connection.query('select uuid,date,slot_info,name from schedule where uuid="'+lawyer_uuid+'"')
        var lawyer_information={};
        query.on('result', function(row) {
           lawyer_information.lawyer_schedule = row
        });
        query.on('end',function(){
            var appointment_request_list = []
            var query= connection.query('select lawyer_uuid,site_user_uuid,date,time_slot,status,lawyer_name,site_user_name from bookings where lawyer_uuid="'+lawyer_uuid+'" and site_user_uuid="'+user_uuid+'"')
            query.on('result', function(row) {
                appointment_request_list.push(row)
            });

            query.on('end',function(){
                lawyer_information.appointment_request_list = appointment_request_list;
                socket.emit('lawyer_information',lawyer_information);
            }); 
        });  
    });



    // Updates the changes in the lawyer schedule.
    socket.on('mainpage_update', function(lawyerSchedule_credentials){
        lawyerSchedule_credentials = lawyerSchedule_credentials;
        var lawyer_schedule_update_result = {}
        var insert_query = 'update schedule set slot_info="'+lawyerSchedule_credentials.slot_info+'" where uuid="'+lawyerSchedule_credentials.uuid+'" and date="'+lawyerSchedule_credentials.date+'"'
        connection.query(insert_query, function(err, rows, fields) {
            if (!err){
                console.log('Lawyer schedule Successfully updated !');
                lawyer_schedule_update_result.success = 1
                lawyer_schedule_update_result.uuid = lawyerSchedule_credentials.uuid
                socket.emit('mainpage_update',lawyer_schedule_update_result);
                io.emit('update_changes',"refresh");
            }
            else{
                console.log('Insert Unsuccessful !!!')
                lawyer_schedule_update_result.success = -1
                lawyer_schedule_update_result.error_msg = 'QUERY_PROBLEM'
                socket.emit('mainpage_update',lawyer_schedule_update_result);
            }
        });   
    });

    // Updates the data base and notfiy users if any appointment request is made
    socket.on('request_appointment', function(request_data){
        var insert_query = 'insert into bookings values("'+request_data.lawyer_uuid+'","'+request_data.site_user_uuid+'","'+request_data.date+'","'+request_data.time_slot+'","'+request_data.status+'","'+request_data.lawyer_name+'","'+request_data.site_user_name+'")'
        connection.query(insert_query, function(err, rows, fields) {
            if (!err){
                console.log('Booking Entered !');
                socket.emit('request_appointment','1');
                io.emit('update_changes',"refresh");

            }
            else{
                console.log(' Booking Insert Unsuccessful !!!')
                socket.emit('request_appointment','-1');
            }
        });      
    });

    // Updates the booking statement of the appointment when lawer accepts or denies it.
     socket.on('booking_appointment_status', function(request_data){
        var update_query = 'update bookings set status="'+request_data.status+'" where lawyer_uuid="'+request_data.lawyer_uuid+'" and site_user_uuid="'+ request_data.site_user_uuid+'" and date="'+ request_data.date+'" and time_slot="'+request_data.time_slot+'"'
        connection.query(update_query, function(err, rows, fields) {
            if (!err){
                console.log('Booking Updated !');
                var query= connection.query('select uuid,date,slot_info from schedule where uuid="'+request_data.lawyer_uuid+'"')
                var lawyer_schedule={};
                query.on('result', function(row) {
                   lawyer_schedule = row
                });
                
                query.on('end',function(){
                    if(request_data.status == "2"){
                        var slot_status_pair_list = lawyer_schedule.slot_info.split(",");
                        var final_slot_info = ""
                        for(var i = 0 ; i < slot_status_pair_list.length ; i++){
                            var slot_status_pair = slot_status_pair_list[i].split(":");
                            var updated_value = slot_status_pair_list[i];
                            if(slot_status_pair[0] == request_data.time_slot){
                                updated_value = slot_status_pair[0]+":"+request_data.status
                            }
                            if(i == slot_status_pair_list.length - 1){
                                final_slot_info += updated_value;
                                continue;
                            }
                            final_slot_info += updated_value+","
                        }
                        var insert_query = 'update schedule set slot_info="'+final_slot_info+'" where uuid="'+request_data.lawyer_uuid+'" and date="'+request_data.date+'"'
                        connection.query(insert_query, function(err, rows, fields) {
                            if (!err){
                                console.log('Lawyer schedule Successfully updated !!!!!!!!!!!!!');
                                socket.emit('booking_appointment_status',{'success':'1','status':request_data.status});
                                io.emit('update_changes',"refresh");
                                if(request_data.site_user_uuid in user_socket_map){
                                    user_socket_map[request_data.site_user_uuid].emit('appointment_confirmation',{'lawyer_name':request_data.lawyer_name,'date':request_data.date,'time_slot':request_data.time_slot,'site_user_name':request_data.site_user_name,'status':"2"});
                                }
                            }
                            else{
                                console.log('Insert Unsuccessful !!!')
                                lawyer_schedule_update_result.success = -1
                                lawyer_schedule_update_result.error_msg = 'QUERY_PROBLEM'
                                socket.emit('booking_appointment_status',{'success':'-1','status':request_data.status});
                                
                            }
                        });   
                    }  
                    else{
                        
                        socket.emit('booking_appointment_status',{'success':'1','status':request_data.status});
                        io.emit('update_changes',"refresh");
                        if(request_data.site_user_uuid in user_socket_map){
                            user_socket_map[request_data.site_user_uuid].emit('appointment_confirmation',{'lawyer_name':request_data.lawyer_name,'date':request_data.date,'time_slot':request_data.time_slot,'site_user_name':request_data.site_user_name,'status':"0"});
                        }

                    }           
                });  
                
            }
            else{
                console.log(' Booking Insert Unsuccessful !!!')
                socket.emit('booking_appointment_status',{'success':'-1','status':request_data.status});
            }
        });      
    });
});
    
// Cron job to which runs everyday at mid night to delete the old entries
// and updates the lawyer schedule for the next day
// Lawyer schedule will show only next day availability but all requests 
var job = new CronJob('00 10 00 * * *', function() {
  /*
   * Runs every day
   * at 00:10:00 AM. 
   */
   var query =  connection.query('select uuid,firstname from users where lawyer="1"')
        var lawyer_uuid_list = [];
        query.on('result', function(row) {
           lawyer_uuid_list.push(row)
        });
        query.on('end',function(){
            console.log(lawyer_uuid_list);
            console.log(lawyer_uuid_list[0]);
            var query =  'truncate schedule'
            connection.query(query, function(err, rows, fields) {
            if (!err){
                console.log('All  entry removed !!!!!!!!!!!!!');
                for(var i = 0 ; i < lawyer_uuid_list.length; i++){
                console.log(lawyer_uuid_list[i]," and i ",i)
                console.log(lawyer_uuid_list[i]);
                var curr_date = new Date();
                var nextday = new Date();
                nextday.setDate(curr_date.getDate()+1);
                var date_params = nextday.toString().split(" ");
                    var date = date_params[2]+"-"+date_params[1]+"-"+date_params[3];
                    var lawyerSchedule_credentials = {'uuid':lawyer_uuid_list[i].uuid,'date':date,'slot_info':'1100-1300:0,1500-1700:0,1900-2100:0','name':lawyer_uuid_list[i].firstname};
                    var insert_query = 'insert into schedule values("'+lawyerSchedule_credentials.uuid+'","'+lawyerSchedule_credentials.date+'","'+lawyerSchedule_credentials.slot_info+'","'+lawyerSchedule_credentials.name+'")'
                    connection.query(insert_query, function(err, rows, fields) {
                        if (!err){
                            console.log('Lawyer schedule Successfully updated !!!!!!!!!!!!!');
                        }
                        else{
                            console.log('Insert Unsuccessful !!!')
                        }
                    });
                }
                var curr_date = new Date();
                var prevday = new Date();
                prevday.setDate(curr_date.getDate()-1);
                var date_params = prevday.toString().split(" ");
                var date = date_params[2]+"-"+date_params[1]+"-"+date_params[3];
                var query =  'delete from bookings where date="'+date+'"'
                connection.query(query, function(err, rows, fields) {
                    if (!err){
                            console.log("Old booking entries deleted!!!")
                    }
                    else{
                            console.log("Failed to delete entries!!!")
                    }
                });

            }
            else{
                console.log(' Delete Unsuccessful !!!')
            }

            }); 
            
        });
  }, function () {
    /* This function is executed when the job stops */
    console.log("Error in Update for new day !!!")
  },
  true, /* Start the job right now */
  'UTC+05:30' /* Time zone of this job. */
);


http.listen(app.get('port'),app.get('ip'));
console.log("Server is Running...")


