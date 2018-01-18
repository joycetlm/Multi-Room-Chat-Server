var user = {"userlist": new Array(), "room": {},"message":{}};
var room = {"roominfo": {}, "roomlist": new Array(), "roomuser":{}, "roomban": {}};
var currentname;
var messageroomname;

// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
 
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	fs.readFile("client.html", function(err, data){
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);
 
// Listen on the port and establish connection:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	
    //receive public message from client
	socket.on('message_to_server', function(data) {
		console.log("public msg: "+data);
		var message = "Messsage: "+ data["message"]+" ; Roomname: "+ data["msg_room"];
		user.message[data["nickname"]].push(message);
		//broadcast public message back to client
		io.sockets.emit("message_to_client",{message: data["message"] , roomname: data["msg_room"],nickname:data["nickname"],msg_toname:"",color:data["color"]}) // broadcast the message to other users
	});
	
	//receive private message from client
	socket.on('privatemsg_to_server',function(data){
	    console.log("private msg: "+data);
	    var message = "Messsage: "+ data["message"]+" ; Roomname: "+ data["msg_room"];
		user.message[data["nickname"]].push(message);
		//broadcast private message back to client
	    io.sockets.emit("message_to_client",{message: data["message"] , roomname: data["msg_room"],nickname:data["nickname"],msg_toname:data["msg_toname"]})
	      
	});
	
	//receive message from lobby room
	socket.on('message_to_server_lobby', function(data) { 
		console.log("lobby_message: "+data["message"]);
		//broadcast message back to client
		io.sockets.emit("message_to_client_lobby",{message: data["nickname"] + " : "+data["message"] })
	});
	
	//receive data from client when client trys to create a new room
    socket.on("newroom", function(data){
		var roomname = data.roomname;
        currentname = data.nickname;
        currentroomname = roomname;        
		//check if the room name has already existed.
	    if (room.roomlist.indexOf(roomname) !== -1) {
			var message = {"success": false, "message": "The room name has been used!"};
			socket.emit("newroomresponse", message);
			return;
		}        
	    else{  
	        console.log("A new created room name is "+roomname);
		    var id = socket.id;
		    var creator = data.creator;
		    var type = data.type;
		    var password = data.password
			//check if a password has been provided when creating a private room
		    if ( type == "private" && password == ''){
		        var message = {"success": false, "message": "To create a private room, you need to set password!"};
			    socket.emit("newroomresponse", message);
			    console.log(message.message);
		    }
		    else{
                console.log("The creator is "+creator);        
		        //store the new room info
		        room.roominfo[roomname] = {"roomname": roomname, "type": type, "password": password, "creator": creator};
		        room.roomlist.push(roomname);		
		        room.roomuser[roomname] = new Array();		
		        room.roomban[roomname] = new Array();		  
                console.log("Create a new room "+room.roominfo[roomname].roomname+" successfully!");
		        var message = {"success": true, "message": "Create a room successfully ","roomname":roomname};
				//success,send response to client
		        socket.emit("newroomresponse", message);
				//update current roomlist
		        socket.broadcast.emit("roomlist", room.roomlist);
		        socket.emit("roomlist", room.roomlist);
		        console.log("room list"+room.roomlist);
		    }
	    }
    });

    //check if the room exists when trying to enter a room	
	socket.on('checkroom', function(data) { 
	    messageroomname = data.roomname;
	    currentroomname = data.roomname;	
	    if(room.roominfo[data.roomname] == null){
			var message = {"success": false, "message": "The room does not exist!"};
			socket.emit("enterroomresponse", message);
			console.log(message.message);
			return;		
	    }	
	    else{
			//check if the user is on ban list of this room
	        if (room.roomban[data["roomname"]].indexOf(data["nickname"]) !== -1) {
			    var message = {"success": false, "message": "You have been baned by the room creator!"};
			    socket.emit("enterroomresponse", message);
			    console.log(message.message);
			    return;
		    }
	        else{
	            currentname = data.nickname;
	            console.log(data);
	            room.roomuser[currentroomname].push(currentname);
	            console.log("userlist : " + room.roomuser[currentroomname]);
	            socket.emit("userlist", room.roomuser[currentroomname]);
	            socket.broadcast.emit("userlist", room.roomuser[currentroomname]);
		        var type = room.roominfo[data.roomname].type;
				//check if the room type is private
		        if (type == 'private'){
		            var passwordstore = room.roominfo[data.roomname].password;
					//check if the user enter the correct password
		            if (passwordstore == data.password){
		                var creator = room.roominfo[data.roomname].creator;
		                var message = {"success": true,"roomname":data.roomname, "creator":creator,"currentname":data.nickname};
		                socket.emit("enterroomresponse", message);
						//check if this is a new nickname
			            if (user.userlist.indexOf(data.nickname) == -1) {
		                    user.userlist.push(data.nickname);
		                    user.room[data.nickname] = new Array();
		                    user.message[data.nickname] = new Array();
		                    user.room[data.nickname].push(data.roomname);
			            }
			            else{
			                var index = user.room[data.nickname].indexOf(data.roomname);
			                //if the user entered the room before, not need to push the data again
	                        if(index = -1){
	                            user.room[data.nickname].push(data.roomname);
	                        }			    
			            }
			            return;
		            }
		            else{
		                var message = {"success": false, "message": "Invalid password for the private room!"};
			            socket.emit("enterroomresponse", message);
			            console.log(message.message);
			            return;
		            }
		        }
		        else{
		            var creator = room.roominfo[data.roomname].creator;
		            var message = {"success": true, "roomname":data.roomname, "creator":creator,"currentname":data.nickname};
		            socket.emit("enterroomresponse", message);
		            // if the nickname is new, create a new userinfo and update the user list
		            if (user.userlist.indexOf(data.nickname) == -1) {
		                user.userlist.push(data.nickname);
		                user.room[data.nickname] = new Array();
		                user.message[data.nickname] = new Array();
		                user.room[data.nickname].push(data.roomname);
			        }
			        else{
			            var index = user.room[data.nickname].indexOf(data.roomname);
			            console.log(index);
			            //if the user entered the room before, not need to push the data again
	                    if(index == -1){
	                        user.room[data.nickname].push(data.roomname);
	                    }        
			        }
			        return;
		        }        
		        return;
		    }
     
        } 
	});

    //update userlist when user leaves the room	
	socket.on('userlist_update',function(data){
	    var index = room.roomuser[data["roomname"]].indexOf(data["nickname"]);
	    if(index > -1){
	        room.roomuser[data["roomname"]].splice(index,1);
	    }
	    socket.emit("userlist", room.roomuser[currentroomname]);
	    socket.broadcast.emit("userlist", room.roomuser[currentroomname]);
	});
	
	//send user profile to client
	socket.on('userinfo',function(data){
	    console.log(user.room[data["nickname"]]);
		//check if the user has sent message before
	    if(user.message[data["nickname"]].length != 0){ 
			socket.emit("showmessage", {message:user.message[data["nickname"]], roomhistory:user.room[data["nickname"]]});
			return;
	    }
	    else{
	        socket.emit("showmessage", {message:"", roomhistory:user.room[data["nickname"]]});
			return;
	    }
	});	
	
	//response to kick people out
	socket.on('kick',function(data){
	    var index = room.roomuser[data["roomname"]].indexOf(data["kickname"]);
	    if(index > -1){
	        room.roomuser[data["roomname"]].splice(index,1);
	        var message = {"success": true, "message_to_creator": "You kick the user successfully!", "message_to_kickname": "You have been kicked by the room creator!","creator":room.roominfo[data.roomname].creator,"kickname":data["kickname"]};
			socket.emit("kickresponse", message);
			socket.broadcast.emit("kickresponse", message);
			socket.emit("userlist", room.roomuser[currentroomname]);
	        socket.broadcast.emit("userlist", room.roomuser[currentroomname]);
			return;
	    }
	    else{
	        var message = {"success": false, "message": "The user you want to kick is not in the room!","creator":room.roominfo[data.roomname].creator };
			socket.emit("kickresponse", message);
			return;
	    }
	});
	
	//response to ban someone
	socket.on('ban',function(data){
	    room.roomban[data["roomname"]].push(data["banname"]);
        var index = room.roomuser[data["roomname"]].indexOf(data["banname"]);
	    if(index > -1){
	        room.roomuser[data["roomname"]].splice(index,1);
	        var message = {"success": true, "message_to_banname": "You have been banned by the room creator!","banname":data["banname"]};
			socket.emit("banresponse", message);
			socket.broadcast.emit("banresponse", message);
			socket.emit("userlist", room.roomuser[currentroomname]);
	        socket.broadcast.emit("userlist", room.roomuser[currentroomname]);
			return;
	    }
	});	
	socket.emit("roomlist", room.roomlist);
	socket.broadcast.emit("roomlist", room.roomlist);
});