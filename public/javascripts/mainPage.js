var socket = io();
var global_uuid;
var current_user;
var selected_lawyer = "no-body";
var status_mapping = {0:'Not Available', 1:'Available', 2:'Booked'}
var appointment_status_map = {0:'Request Rejected', 1:'Request Pending for Approval', 2:' Your Appointment is Confimed'}
var user_status_mapping = {0:'Not Available', 1:'Available', 2:'Already Booked By Another Person'}
var schedule_date;
var schedule_time_slot = [];

// function for logging out.
function logout(){
	socket.emit('logout',global_uuid)
	window.open("/logout","_self");	
} 

// If the lawyer accepts the request, the same is sent to the server. 
function acceptRequest(site_user_uuid,date,time_slot,site_user_name){
	console.log("acceptRequest");
	var request_data = {'lawyer_uuid':global_uuid,'site_user_uuid':site_user_uuid,'date':date,'time_slot':time_slot,'status':'2','lawyer_name':current_user.firstname,'site_user_name':site_user_name}
	socket.emit('booking_appointment_status',request_data);
}

// If the lawyer rejects the request, the same is sent to the server. 
function rejectRequest(site_user_uuid,date,time_slot,site_user_name){
	console.log("rejectRequest");
	var request_data = {'lawyer_uuid':global_uuid,'site_user_uuid':site_user_uuid,'date':date,'time_slot':time_slot,'status':'0','lawyer_name':current_user.firstname,'site_user_name':site_user_name}
	socket.emit('booking_appointment_status',request_data);
}

// User request the appointment. 
// Executed when user click on request appointment
function requestAppointment(name){
	var request_data = {'lawyer_uuid':selected_lawyer,'site_user_uuid':global_uuid,'date':schedule_date,'status':'1','lawyer_name':name,'site_user_name':current_user.firstname};
	var time_slot = "";
	console.log(schedule_time_slot)
	for(var i = 0 ; i < schedule_time_slot.length ; i++){
		var value;
		if(document.getElementById(schedule_date+"_"+schedule_time_slot[i]+"_0").checked){
			time_slot = schedule_time_slot[i];
		}
	}
	if(time_slot == ""){
		alert("No slot selected !!!");
		return;
	}
	request_data.time_slot = time_slot;
	socket.emit('request_appointment',request_data);
}

// To update the lawyer schedule
// Sends the updated data to server
function updateSchedule(){
	var schedule_update_data = {'uuid':global_uuid,'date':schedule_date};
	var slot_info = "";
	for(var i = 0 ; i < schedule_time_slot.length ; i++){
		var value;
		if($('#'+schedule_date+"_"+schedule_time_slot[i]+"_0").is(':checked')){
			value = "0";
		}
		else if($('#'+schedule_date+"_"+schedule_time_slot[i]+"_1").is(':checked')){
			value = "1";
		}		
		else if($('#'+schedule_date+"_"+schedule_time_slot[i]+"_2").is(':checked')){
			value = "2";
		}
		if(i == schedule_time_slot.length -1){
			slot_info += schedule_time_slot[i]+":"+value;
			continue;
		}
		slot_info += schedule_time_slot[i]+":"+value+","
	}
	schedule_update_data.slot_info = slot_info;
	socket.emit('mainpage_update',schedule_update_data);
}


// Initializes the site user page when user first loads the page
function populate_site_user_page(user_data){

	current_user = user_data.current_user;
	var lawyer_list = user_data.lawyer_list;
	$("#user_name").append( "Welcome "+current_user.firstname);
	var lawyer_list_div = $("#left_panel");
	var size = lawyer_list.length;

	for(var i = 0; i < size; i++){
		var lawyer = lawyer_list[i];
		var fullName = lawyer.firstname+" "+lawyer.lastname;
		var introduction = lawyer.details;
		lawyer_list_div.append('<div id="' + lawyer.uuid+'" style=" cursor: pointer; width:98%; margin: 0 auto; background-color:white; padding:10px; box-shadow: 5px 5px 5px #888888;border: thin solid #d3d3d3; border-radius:2%">'+'<h3> Lawyer Name - '+fullName+'</h3> <h4> Introduction: </h4><p>'+introduction+'</p> <p> Select this lawyer to book an appointment. </p></div>')
		
		$('#'+lawyer.uuid).click(function(event) {
		    selected_lawyer = $(this).attr('id');
		    document.getElementById('right_panel').innerHTML="";
		    schedule_time_slot = []
		    // Make a call to get the data.
		    socket.emit('lawyer_information',{'lawyer_uuid':selected_lawyer,'user_uuid':global_uuid});
		});

		$('#'+lawyer.uuid).hover(
			function() {
			  $(this).css('background-color', '#d3d3d3');
			},
			function () {
		              $(this).css({"background-color":"white"});
		           }
		    );
	}
}

// Initializes the lawyer page when lawyer first loads the page
function populate_lawyer_page(user_data){

	current_user = user_data.current_user;
	var appointment_request_list = user_data.appointment_request_list;
	var lawyer_schedule = user_data.lawyer_schedule;
	$("#user_name").append( "Welcome "+current_user.firstname);

	var appointment_request_panel = $("#right_panel");
	var lawyer_schedule_panel = $("#left_panel");

	lawyer_schedule_panel.append('<div id="'+current_user.uuid+'_schedule"> <h2> Your Next Day Schedule </h2> <h3> Date - '+lawyer_schedule.date+'</h3>   </div>')
	var schedule_div = $("#"+current_user.uuid+'_schedule');
	var time_slot_information = lawyer_schedule.slot_info.split(",");
	var size = time_slot_information.length;
	var time_status_map = {}
	schedule_date = lawyer_schedule.date;
	for (var i = 0; i < size; i++ ){
		var time_status_pair = time_slot_information[i].split(":");
		time_status_map[time_status_pair[0]] = parseInt(time_status_pair[1]);
		schedule_time_slot.push(time_status_pair[0]);
		schedule_div.append('<br><div id="'+lawyer_schedule.date+'_'+time_status_pair[0]+ '" style=" padding:10px; border: thin solid #d3d3d3; border-radius:2%"> <h4> Time Slot :  '+time_status_pair[0]+' </h4> <h4 id="'+lawyer_schedule.date+'_'+time_status_pair[0]+'_status"> Current Status - '+status_mapping[time_status_pair[1]]+' </h4>'+'<form role="form"> <label class="radio-inline"><input id="'+lawyer_schedule.date+'_'+time_status_pair[0]+'_0"  type="radio" value="0" name="status">'+status_mapping[0]+'</label><label class="radio-inline"><input id="'+lawyer_schedule.date+'_'+time_status_pair[0]+'_1" type="radio" value="1" name="status">'+status_mapping[1]+'</label><label class="radio-inline"><input id="'+lawyer_schedule.date+'_'+time_status_pair[0]+'_2"  type="radio" value="2" name="status">'+status_mapping[2]+'</label></form>'+'</div>')
		$("#"+lawyer_schedule.date+"_"+time_status_pair[0]+"_"+time_status_pair[1]).prop("checked", true);
		if(time_status_pair[1]== "2"){
			document.getElementById(lawyer_schedule.date+"_"+time_status_pair[0]+"_0").disabled = true;
			document.getElementById(lawyer_schedule.date+"_"+time_status_pair[0]+"_1").disabled = true;
			document.getElementById(lawyer_schedule.date+"_"+time_status_pair[0]+"_2").disabled = true;
		}
	}


	lawyer_schedule_panel.append('<button type="button" class="btn btn-primary navbar-btn" style="float:right;" onclick="updateSchedule()">Update Schedule</button>');

	size = appointment_request_list.length;
	console.log("sizeeeee "+size)
	if(size == 0){
		document.getElementById("right_panel").innerHTML = "";
		appointment_request_panel.append("<h1> No Appointment Requests !!!</h1>")
	}
	else{
		console.log("sizeeeee "+size)
		document.getElementById("right_panel").innerHTML = "<h1>Appointment Requests: </h1>";
		for (var i = 0; i < size; i++ ){

			var appointment_request = appointment_request_list[i];
			if(appointment_request.status == "2"){
				var date = appointment_request.date;
				var current_date = new Date();
				var nextDay = new Date();
				nextDay.setDate(current_date.getDate()+1);
				var date_params = nextDay.toString().split(" ");
                var next_date_str = date_params[2]+"-"+date_params[1]+"-"+date_params[3];
                if(date != next_date_str){
                		continue;
                }
				var time_slot = appointment_request.time_slot;
				console.log(date,time_slot)
				$("#"+date+"_"+time_slot+"_2").prop("checked", true);
				document.getElementById(date+"_"+time_slot+"_status").innerHTML ='Current Status - '+status_mapping[2];
				
				document.getElementById(date+"_"+time_slot+"_0").disabled = true;
				document.getElementById(date+"_"+time_slot+"_1").disabled = true;
				document.getElementById(date+"_"+time_slot+"_2").disabled = true;
				appointment_request_panel.append('<div style=" padding:10px; border: thin solid #d3d3d3; border-radius:2%;"> <h2> '+ appointment_request.site_user_name+ '</h2> <h3> Appointment Date : '+appointment_request.date+' </h3> <h3> Time Slot : '+appointment_request.time_slot+'</h3> <h3> Appointment Status : '+ appointment_status_map[appointment_request.status] +'</div>')

			}
			else if(appointment_request.status == "1"){
				appointment_request_panel.append('<div style=" padding:10px; border: thin solid #d3d3d3; border-radius:2%;"> <h2> '+ appointment_request.site_user_name+ '</h2> <h3> Appointment Date : '+appointment_request.date+' </h3> <h3> Time Slot : '+appointment_request.time_slot+'</h3> <h3> Appointment Status : '+ appointment_status_map[appointment_request.status] +' <button type="button" class="btn btn-primary navbar-btn" style="display:inline-block;" onclick="acceptRequest(\''+appointment_request.site_user_uuid+'\',\''+appointment_request.date+'\',\''+appointment_request.time_slot+'\',\''+appointment_request.site_user_name+'\')">Accept Request</button>'+'<button type="button" class="btn btn-primary navbar-btn" style="display:inline-block;" onclick="rejectRequest(\''+appointment_request.site_user_uuid+'\',\''+appointment_request.date+'\',\''+appointment_request.time_slot+'\',\''+appointment_request.site_user_name+'\')">Reject Request</button>' +'</div>')
			}
			else{
				appointment_request_panel.append('<div style=" padding:10px; border: thin solid #d3d3d3; border-radius:2%;"> <h2> '+ appointment_request.site_user_name+ '</h2> <h3> Appointment Date : '+appointment_request.date+' </h3> <h3> Time Slot : '+appointment_request.time_slot+'</h3> <h3> Appointment Status : '+ appointment_status_map[appointment_request.status] +'</div>')
			}
		}
	}
}

$(document).ready(function(){
	var current_url = String(window.location.href);
	var index = current_url.indexOf("?id=");
	var user_uuid = current_url.substr(index+4)
	global_uuid = user_uuid
	socket.emit('mainpage_initialization', user_uuid);

	// Listen the reply from server to get the all data to render on the page.
	socket.on('mainpage_initialization', function(user_data){
		current_user = user_data.current_user;
		if(current_user.lawyer == "0"){
			populate_site_user_page(user_data)
		}
		else{
			populate_lawyer_page(user_data)
		}
	});

		// Updates the lawyer schedule when server sends the data and notifies user
		socket.on('mainpage_update',function(lawyer_schedule_update_result){
		        if(lawyer_schedule_update_result.success==1){
		        	console.log("Lawyer Schedule Successfully updated");
		        }
		        else{
		        	console.log("update failed failed !!!")
		        }

			});

		// Lawyer related information is rendered on the user page dynamically
		socket.on('lawyer_information',function(lawyer_information){
	        var lawyer_schedule = lawyer_information.lawyer_schedule;
	        var appointment_request_list = lawyer_information.appointment_request_list;
	        var lawyer_schedule_panel = $("#right_panel");

			lawyer_schedule_panel.append('<div id="'+lawyer_schedule.uuid+'_schedule"> <h2> Schedule and Booking History With '+lawyer_schedule.name+'  </h2> <h3> Date - '+lawyer_schedule.date+'</h3>   </div>')
			var schedule_div = $("#"+lawyer_schedule.uuid+'_schedule');
			var time_slot_information = lawyer_schedule.slot_info.split(",");
			var size = time_slot_information.length;
			var time_status_map = {}
			schedule_date = lawyer_schedule.date;
			for (var i = 0; i < size; i++ ){
				var time_status_pair = time_slot_information[i].split(":");
				time_status_map[time_status_pair[0]] = parseInt(time_status_pair[1]);
				schedule_time_slot.push(time_status_pair[0]);
				schedule_div.append('<br><div id="'+lawyer_schedule.date+'_'+time_status_pair[0]+ '" style=" padding:10px; border: thin solid #d3d3d3; border-radius:2%"> <h4> Time Slot :  '+time_status_pair[0]+' </h4> <h4 id="'+lawyer_schedule.date+'_'+time_status_pair[0]+'_status"> Current Status - '+user_status_mapping[time_status_pair[1]]+' </h4>'+'<form role="form"> <label ><input id="'+lawyer_schedule.date+'_'+time_status_pair[0]+'_0"  type="checkbox" value="0" name="select">'+'Select Slot'+'</label></form>'+'</div>')
				if(time_status_pair[1]== "2" || time_status_pair[1]== "0"){
					document.getElementById(lawyer_schedule.date+"_"+time_status_pair[0]+"_0").disabled = true;
				}
			}

			for(var i = 0 ; i < appointment_request_list.length ; i++){
				var appointment_request = appointment_request_list[i];
				var current_date = new Date();
				var nextDay = new Date();
				nextDay.setDate(current_date.getDate()+1);
				var date_params = nextDay.toString().split(" ");
                var next_date_str = date_params[2]+"-"+date_params[1]+"-"+date_params[3];
                if(appointment_request.date != next_date_str){
                		continue;
                }
				document.getElementById(appointment_request.date+"_"+appointment_request.time_slot+"_status").innerHTML ='Current Status - '+appointment_status_map[appointment_request.status];
				document.getElementById(appointment_request.date+"_"+appointment_request.time_slot+"_0").disabled = true;
			}
			lawyer_schedule_panel.append('<button type="button" class="btn btn-primary navbar-btn" style="float:right;" onclick="requestAppointment(\''+lawyer_schedule.name+'\')">Request Appointment</button> <h4>Please Choose only one slot!!! If more than one selected, Only one slot request will be sent. </h4>');

			});

		// Generate alert if request is sent on server
		socket.on('request_appointment',function(status){
				if(status == "1"){
					alert("Appointment Request Sent !!!")
				}
				var current_url = String(window.location.href);
				window.open(current_url,"_self")
		});

		// Generate alert if schedule is updates on server
		socket.on('mainpage_update',function(response){
				if(response.success == "1"){
					alert("Your Schedule is updated !!!")
				}
				var current_url = String(window.location.href);
				window.open(current_url,"_self")
		});

		// Generate alert if request is sent on server
		socket.on('booking_appointment_status',function(response){
				if(response.success == "1"){
					if(response.status == "2"){
						alert("Request Accepted. Information sent !!! ")
					}
					else if(response.status == "0"){
						alert("Request Rejected. Information sent !!! Refresh to see the changes.")
					}
					
				}
				else{
					alert("Error in sending. Try Again!!!")
					
				}
				var current_url = String(window.location.href);
				window.open(current_url,"_self");
		});

		socket.on('update_changes',function(response){
			var current_url = String(window.location.href);
			window.open(current_url,"_self")
		});
	// Listening appointment_confirmation from the server.
		socket.on('appointment_confirmation',function(response){
			var accept_message = "Hello "+response.site_user_name+ ", Lawyer - "+response.lawyer_name+" has accepted your appointment. Please meet him on "+response.date+" between "+response.time_slot+" Thank You :)";
			var reject_message = "Hello "+response.site_user_name+ ", Lawyer - "+response.lawyer_name+" has Rejected your appointment on "+response.date+" between "+response.time_slot+"";
			if(response.status == "2"){
				alert(accept_message);
			}
			else{
				alert(reject_message);
			}
		});

});