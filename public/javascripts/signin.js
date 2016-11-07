$(document).ready(function(){
	$("#signinform").submit(function(){
		var username=$("#username").val();
		var password=$("#password").val();
		var checkbox = document.getElementById('remember').checked;
	// Storing signIn data in signIn credentials.
		var signin_credentials = {username:username,password:password,remember:checkbox};
		console.log("signin call...");

	// Sending SignIn credentials to the server through ajax call.
		$.ajax({
			    type: 'POST',
			    url: '/authentication',
			    data: JSON.stringify(signin_credentials),
			    contentType: "application/json; charset=utf-8",
			    dataType: "json",
			    processData : false,
		    //Receiving SignIn result from the server. 
			    success : function(signin_result){
			        if(signin_result.success==1)
					{
						window.open("/mainpage?id="+signin_result.uuid,"_self");
					}
			    },
			    error : function(){
			        console.log("Signin Call failed !!!")
			    }
			});
		event.preventDefault();
	});

});