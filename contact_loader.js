function get_request_key(traits, parameters) 
{
	var key = ""; 	
		
	switch (traits.method_name) {
	case "getProfiles":
		key += traits.method_name + ",";
		key += parameters.contact.uid;
		break;

	case "execute":
		key += "friends.getMutual,";
		key += parameters.contact_1.uid + "," + parameters.contact_2.uid;
		break;
	default:
		alert("unsupported: traits.method_name == " + traits.method_name);
		break;
	}
	
	
	
	return key;
}


function contact_loader()
{
	this.timeout_id = undefined;

	this.queue = new Array();

	var this_local = this;

	this.load = function(traits, parameters,callback) {		
		
		var key = get_request_key(traits, parameters);

		var response = localStorage.getItem(key);
		if (response != null) {
			traits.response_handler(parameters,JSON.parse(response));
			setTimeout(function() {
				callback(parameters, "Success");				
			},0);				
			setTimeout(function() {
				if (!this_local.timeout_id) {
					this_local.timeout_id = window.setTimeout(this_local.process_sheduled_task, 100);
				}
				this_local.queue_request(traits,parameters, function(parameters, message) {				
				}, 1);
			}, 1600);
				
		} else {
			this.queue_request(traits,parameters, callback, 1);			
		}
	};
	
	this.queue_request = function( traits,parameters, callback,size_factor) {		
/*
	if (contact.uid == 863449
		|| contact.uid == 625145
		|| contact.uid == 366083
		|| contact.uid == 1913524
		|| contact.uid == 12246048) {
			callback(contact.uid,"unserved");
			return;
	}
*/	
		var request = { traits:traits,parameters:parameters, 
							done: false, on_done:callback,size_factor:size_factor}
		this.queue.push( request);
		if (!this.timeout_id) {
			this.timeout_id = window.setTimeout(this.process_sheduled_task, 0);
		}
		
	};
	
	this.process_sheduled_task = function() { 
		this_local.send_next_request();
		if (this_local.queue.length != 0) {
			this_local.timeout_id = window.setTimeout(this_local.process_sheduled_task,400);					
		} else {
			this_local.timeout_id = undefined;
		}
	};
	

	
	
	
	this.send_next_request = function() {
	
		if (this.queue.length == 0) {
			return;
		}

		var traits_of_current_requests = this.queue[0].traits;
		var details_requests = [];
		var sum = 0;
		var remains_of_queue = [];
		for (var index = 0; index < this.queue.length;index++) {
			if (this.queue[index].traits == traits_of_current_requests
				&& sum + this.queue[index].size_factor <= traits_of_current_requests.max_sum) {
				sum += this.queue[index].size_factor;
				var details_request = this.queue[index];
				details_requests.push(details_request);				
			} else {
				remains_of_queue.push(this.queue[index]);
			}
		}
		this.queue = remains_of_queue;
		
		setTimeout( function() { 
			for (var i = 0; i < details_requests.length; i++) {
				var details_request = details_requests[i];
				if (!details_request.done) {
					details_request.done = true;
					var new_size_factor = details_request.size_factor*2;
					if (new_size_factor > details_request.traits.max_sum) {
						details_request.on_done(details_request.parameters,"Request timeout");				
					}
					else
					{
						this_local.queue_request(details_request.traits, details_request.parameters
											,details_request.on_done,new_size_factor);
					}
				}
			} 
		}, 10500);
	
		var traits = details_requests[0].traits;
		VK.api(traits.method_name, traits.parameters_builder(details_requests) , function(data) { 
			if (data.error && data.error.error_msg == "Runtime error: Run-time error: Too many API calls\n") {
				alert(data.error.error_msg);
			}
			for (var i = 0; i < details_requests.length; i++) {
			
				if (details_requests[i].done) {
					continue;
				}

				details_requests[i].done = true;
				if (data.error) {
					if (data.error.error_msg == "Too many requests per second") {
						this_local.queue_request(details_requests[i].traits, details_requests[i].parameters
												, details_requests[i].on_done,details_requests[i].size_factor);
					}	else {
						details_requests[i].on_done( details_requests[i].parameters,data.error.error_msg);
					}
				} else {
					var details_request = details_requests[i];
					var response = data.response[i];
					
					var key = get_request_key(traits, details_request.parameters);
					localStorage.setItem(key,JSON.stringify(response));
					
					if (response == false) {
						details_request.on_done(details_request.parameters, "Failure");
						continue;
					}					
					traits.response_handler(details_request.parameters,response);										
					details_request.on_done(details_request.parameters, "Success");
				}
				
			}
		});	
		
	};

	

}
