const express	= require('express');
const cookparse	= require('cookie-parser');
const mysql 	= require('mysql');
const path		= require('path');
const fetch		= require('node-fetch');

require('dotenv').config();

const db	= mysql.createConnection({
										host:process.env.DB_HOST,
										user: process.env.DB_USER,
										password: process.env.DB_PASS,
										database: process.env.DB_NAME
									});

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookparse());

app.use(express.static(__dirname + '/public'));

const genCode = function(table,num) {
	var codestring="";
	var codenum=0;
	while (codenum<(num==undefined ? 4 : num)){
		codestring=codestring+table[Math.floor(Math.random() * (table.length))];
		codenum=codenum+1;
	}
	return codestring;
}

async function setup() {
	db.query(`CREATE TABLE IF NOT EXISTS links(
		id					VARCHAR(8) PRIMARY KEY,
		link 				TEXT NOT NULL
	)`)
}

async function isValidUser(user, pass) {
	return new Promise((res,rej)=>{
		db.query(`SELECT * FROM users WHERE name=? AND password=?`,[user,pass],(err,rows)=>{
			if(err) {
				console.log(err);
				res(false);
			}
			if(rows[0]) {
				res(true);
			} else {
				res(false);
			}
		})
	})
}

async function linkExists(link) {
	return new Promise((res,rej)=>{
		db.query(`SELECT * FROM links WHERE link=?`,[link],(err,rows)=>{
			if(err) {
				console.log(err);
				res([false]);
			}
			if(rows[0]) {
				res([true,rows[0]]);
			} else {
				res([false]);
			}
		})
	})
}

async function linkExistsID(id) {
	return new Promise((res,rej)=>{
		db.query(`SELECT * FROM links WHERE id=?`,[id],(err,rows)=>{
			if(err) {
				console.log(err);
				res([false]);
			}
			if(rows[0]) {
				res([true,rows[0]]);
			} else {
				res([false]);
			}
		})
	})
}

app.get("/",async (req,res)=>{
	if(req.cookies.user) {
		var user = JSON.parse(req.cookies.user);
		var valid = await isValidUser(user.name, user.pass);
		if(!valid) {
			console.log(req.cookies.user);
			res.sendFile(path.resolve("pages/login.html"));
		} else {
			res.sendFile(path.resolve("pages/index.html"));
		}
	} else {
		console.log(req.cookies.user);
		res.sendFile(path.resolve("pages/login.html"));
	}
})

app.get("/add",(req,res)=>{
	res.sendFile(path.resolve("pages/add.html"));
})

app.get("/del",(req,res)=>{
	res.sendFile(path.resolve("pages/delete.html"));
})

app.get("/list",async (req,res)=>{
	if(req.cookies.user) {
		var user = JSON.parse(req.cookies.user);
		var valid = await isValidUser(user.name, user.pass);
		if(!valid) {
			res.sendFile(path.resolve("pages/list.html"));
		} else {
			db.query(`SELECT * FROM links`,(err,rows)=>{
				if(err) {
					console.log(err);
					res.send("ERR")
				} else {
					res.send(rows.map(l => {
						return {id: l.id, link: l.link}
					}));
				}
			})
		}
	} else {
		res.sendFile(path.resolve("pages/login.html"));
	}
})

app.get("/:id",async (req,res)=>{
	db.query(`SELECT * FROM links WHERE id=?`,[req.params.id],(err,rows)=>{
		if(err) {
			console.log(err);
			res.send("There was an error.");
		} else if(!rows[0]) {
			res.send(`Link \'${req.params.id}\' not found.`)
		} else {
			res.redirect(rows[0].link);
		}
	})
})

app.post("/link",async (req,res)=>{
	var user;
	if(req.cookies.user) user = JSON.parse(req.cookies.user);
	else user = {name: req.body.name, pass: req.body.pass}
	var valid = await isValidUser(user.name, user.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	var exists = await linkExists(req.body.link);
	if(exists[0]){
		res.send({status: "EXISTS", link: "https://greys.tk/"+exists[1].id});
		return;
	}
	var code = genCode(process.env.CHARACTERS);
	db.query(`INSERT INTO links SET ?`,{id: code, link: req.body.link},(err,rows)=>{
		if(err) {
			console.log(err);
			res.send("ERR")
		} else {
			res.send({status: "OK", link: "https://greys.tk/"+code});
		}
	})
})

app.post("/unlink",async (req,res)=>{
	var user;
	if(req.cookies.user) user = JSON.parse(req.cookies.user);
	else user = {name: req.body.name, pass: req.body.pass}
	var valid = await isValidUser(user.name, user.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	var exists = await linkExistsID(req.body.link);
	if(!exists[0]){
		res.send({status: "DOES NOT EXIST"});
		return;
	}
	db.query(`DELETE FROM links WHERE id=?`,[req.body.link],(err,rows)=>{
		if(err) {
			console.log(err);
			res.send("ERR")
		} else {
			res.send({status: "OK"});
		}
	})
})

app.post("/links",async (req,res)=>{
	var user;
	if(req.cookies.user) user = JSON.parse(req.cookies.user);
	else user = {name: req.body.name, pass: req.body.pass}
	var valid = await isValidUser(user.name, user.pass);	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	db.query(`SELECT * FROM links`,(err,rows)=>{
		if(err) {
			console.log(err);
			res.send("ERR")
		} else {
			res.send(rows.map(l => {
				return {id: l.id, link: l.link}
			}));
		}
	})
})

app.post("/login",async (req,res)=>{
	var valid = await isValidUser(req.body.name, req.body.pass);
	if(!valid) {
		res.send("ERR: INVALID LOGIN.")
		return;
	}
	res.cookie('user', JSON.stringify({name: req.body.name, pass: req.body.pass}), {path: "/", expires: new Date(Date.now() + 10000000)});
	res.redirect('/');
})

setup();
app.listen(process.env.PORT || 8080);

process.on('SIGINT',()=>{
	db.end(()=>{
		console.log("connection severed");
		process.exit();
	})
})

process.on('SIGTERM',()=>{
	db.end(()=>{
		console.log("connection severed");
		process.exit();
	})
})