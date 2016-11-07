$(document).ready(function(){
	console.log("ready")
	var current_url = String(window.location.href);
	var index = current_url.indexOf("?id=");
	var user_uuid = current_url.substr(index+4)
	console.log(user_uuid)

	$("#lawyerDetails").submit(function(){
		var lawyerDetails=$("#introduction").val();
		var lawyer_details = {uuid:user_uuid,details:lawyerDetails};
		console.log("Submitting details...");
		$.ajax({
			    type: 'POST',
			    url: '/lawyer_details',
			    data: JSON.stringify(lawyer_details),
			    contentType: "application/json; charset=utf-8",
			    dataType: "json",
			    processData : false,
			    success : function(response){
			        console.log(response);
			        if(response.success==1)
					{
						window.open("/mainpage?id="+response.uuid,"_self");
					}
			    },
			    error : function(){
			        console.log("Update Call failed !!!")
			    }
			});
		event.preventDefault();
	});

});