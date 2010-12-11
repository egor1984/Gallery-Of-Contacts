function contact_loader(api_function_name,api_function_arguments_builder
					,contact_update_code,max_sum)
{

	this.api_function_name = api_function_name;
	this.api_function_arguments_builder = api_function_arguments_builder;
	this.contact_update_code = contact_update_code;
	this.max_sum = max_sum;
	this.queue = new Array();
	
	this.load = function( arguments,callback) {
		this.queue_request(arguments, callback, 1);
	}

	this.queue_request = function( arguments, callback,size_factor) {		
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
		this.queue.push( { arguments:arguments, 
							done: false, on_done:callback,size_factor:size_factor});
	};
	
	var this_local = this;

	
	
	
	this.send_next_request = function() {
	
		if (this.queue.length == 0) {
			return;
		}

		var details_requests = [];
		var sum = 0;
		while (this.queue.length != 0 && sum + this.queue[0].size_factor <= this.max_sum) {
			sum += this.queue[0].size_factor;
			details_requests.push(this.queue.shift());
		}
		
		setTimeout( function() { 
			for (var i = 0; i < details_requests.length; i++) {
				var details_request = details_requests[i];
				if (!details_request.done) {
					details_request.done = true;
					var new_size_factor = details_request.size_factor*2;
					if (new_size_factor > this_local.max_sum) {
						details_request.on_done("Request timeout");				
					}
					else
					{
						this_local.queue_request( arguments
											,details_request.on_done,new_size_factor);
					}
				}
			} 
		}, 10500);
	
		VK.api(this.api_function_name, this.api_function_arguments_builder(details_requests) , function(data) { 
			for (var i = 0; i < details_requests.length; i++) {
			
				if (details_requests[i].done) {
					continue;
				}

				details_requests[i].done = true;
				if (data.error) {
					if (data.error.error_msg == "Too many requests per second"
						|| data.error.error_msg == "Runtime error: Run-time error: Too many API calls\n") {
						this_local.queue_request( details_requests[i].arguments
												, details_requests[i].on_done,details_requests[i].size_factor);
					}	else {
						details_requests[i].on_done( data.error.error_msg);
					}
				} else {
					var details_request = details_requests[i];
					var response = data.response[i];
					if (response == false) {
						details_request.on_done( "Failure");
						continue;
					}					
					this_local.contact_update_code(details_request.arguments,response);
					
					details_request.on_done( "Success");
				}
				
			}
		});	
		
	};

	

}
