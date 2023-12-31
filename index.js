const express = require('express');
const app = express();
const cors= require('cors');
const jwt = require("jsonwebtoken");
require('dotenv').config()
const stripe=require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;



// middleware

app.use(cors());
app.use(express.json());

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8w6slpa.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 20,
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // client.connect((error) => {
    //   if (error) {
    //     console.error(error);
    //     return;
    //   }
    // });

    const classCollection=client.db('musicDB').collection('classes')
    const userCollection = client.db("musicDB").collection("users");
    const selectClassCollection=client.db('musicDB').collection('select')
    const paymentCollection=client.db("musicDB").collection('payment')
    const enrollCollection=client.db('musicDB').collection('enroll')




    app.get("/users",  async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role === "admin") {
        res.send({ admin: true });
      } else {
        res.send({ admin: false });
      }
    });

    // popular class related api

    app.get('/popularClass', async (req, res) => {
      const result = await classCollection.find({ status: "approved" }).sort({ totalStudent: -1 }).limit(6).toArray();
      res.send(result);
  })


    // instructor related api
    app.get('/instructors', async (req, res) => {
      const result = await userCollection.find({ role: 'instructor' }).toArray();
      res.send(result);
  })


    app.get("/users/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role === "instructor") {
        res.send({ instructor: true });
      } else {
        res.send({ instructor: false });
      }
    });

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existUser = await userCollection.findOne(query);
      console.log(existUser);
      if (existUser) {
        return res.send({ massage: "user is exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });


    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

  


    // add a class related api

    app.get("/classes", async(req,res)=>{
      const result = await classCollection.find().toArray();
      res.send(result)
    })

    app.post('/classes', verifyJwt, async (req, res) => {
      const classes = req.body;
      const result = await classCollection.insertOne(classes);
      res.send(result);

    });

    app.get("/approvedClass", async(req,res)=>{
      const result = await classCollection.find({status:"approved"}).toArray();
      res.send(result)
    })
      // my class related api
      app.get('/myClass', verifyJwt, async (req, res) => {
        try {
            const email = req.query.email;
            const query = { instructorEmail: email };
            const user = await classCollection.find(query).toArray();
            res.send(user);
        } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
        }
    });

     app.patch("/classes/:id", async(req,res)=>{
        const id=req.params.id;
        const filter= {_id: new ObjectId(id)}
        const updatedDoc={
          $set:{
            status:"approved"
          }
        }

        const result = await classCollection.updateOne(filter, updatedDoc);
         res.send(result);

        
      });

      // selected class related api

      app.get("/selectedClass", async(req,res)=>{
        const email = req.query.email;
        const query = { email: email };
        const result=await selectClassCollection.find(query).toArray();
        res.send(result)
      })


      app.get('/selected',verifyJwt, async (req, res) => {
        const email = req.query.email;
        if (!email) {
            res.send([])
        }

        const query = { email: email };
        
        const result = await selectClassCollection.find(query).toArray();
        res.send(result);
    })

      app.post('/selectedClass', async (req, res) =>{
        const classes = req.body;
        const result = await selectClassCollection.insertOne(classes);
        res.send(result);
    })


    app.patch('/totalStudent/:id', async (req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const enrollClass = await classCollection.findOne(filter)
      const totalStudent ={
          $set:{
              totalStudent: enrollClass.totalStudent +1
          }
      }
      const result = await classCollection.updateOne(filter, totalStudent);
      res.send(result)
  })

  app.post('/create-payment-intent', verifyJwt, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
    });

    res.send({
        clientSecret: paymentIntent.client_secret
    })
})




    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: new ObjectId(payment.selectedClass) };
      const deleteResult = await selectClassCollection.deleteOne(query);

      // Update the seat count for each selected class
      const filter = { _id: new ObjectId(payment?.enrolledClass) };
      const options = {
          projection: {
              _id: 0,
              className: 1,
              classImage: 1,
              instructorEmail: 1,
              instructorName: 1,
              price: 1,
              seats: 1,
          },
      };

      const enrolled = await classCollection.findOne(filter,options);
      enrolled.email = payment?.email
      console.log(enrolled,payment.email)
      const enrolledResult = await enrollCollection.insertOne(enrolled)

      const totalUpdateSeats = {
          $set: {
              seats: enrolled.seats - 1,
          },
      };
      const updateSeats = await classCollection.updateOne(
          filter,
          totalUpdateSeats
      );
      res.send({ insertResult, deleteResult ,enrolledResult, updateSeats,  });
  });



  //enroll related api

  app.get("/enrollClass", async(req,res)=>{
    const result=await enrollCollection.find().toArray()
    res.send(result);
  })




    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req,res)=>{
    res.send('music is singing')
});

app.listen(port, ()=>{
    console.log(`music hunt is running on port ${port}`);
})