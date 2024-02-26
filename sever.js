const express = require('express');
const { OpenAI } = require("openai");
require('./dbconn')
require('dotenv').config();
const jwt = require("jsonwebtoken")
const bcrypt = require('bcrypt')
const stripe = require('stripe')('sk_test_51MXBeYIzb8Qf9yX4R31E0kXa6CwquUq2YW3cbE7fEaEsap5hiSfxHMhfxDZ46oRrUV6Z43uNVlHsGNf4Fk5uj9Aq00EqwfAipj', {
    apiVersion: '2022-11-15'
  });
const app = express();
const { gql} = require('apollo-server')
const { ApolloServer } = require('apollo-server-express');
const { v4: uuidv4 } = require('uuid');
const User = require("./models/user")


const PORT = 3000;

// Asegúrate de que la clave API está siendo cargada correctamente
console.log("Clave API:", process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

const typeDefs = gql`
  type User {
    id: ID
    username: String
    email: String
    name: String
    psswdHash: String
    premium: Boolean
  }

  type Token {
    value: String!
  }

  type Query {
    me: User
  }
  type Mutation {
    addUser(
      username: String
      email: String
      name: String
      password: String
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }
`

const resolvers = {
  Query: {
    me: async(root, args, context) => {
      const me = await User.findOne({_id: context.currentUser._id})
      
      return me
  },
  },
  Mutation: {
    addUser: async (_, args) => {

      console.log("Estas en addUser antes de todo")

      const salt = await bcrypt.genSalt(10)

      const hashedPsswd = await bcrypt.hash(args.password, salt)

      const newUser = new User({
          username: args.username,
          email: args.email,
          name: args.name,
          psswdHash: hashedPsswd,
          premium: false
      })


      return newUser.save()
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });

      if(!user) {
          throw new Error('Invalid Credentials')
      }


      const match = await bcrypt.compare(args.password, user.psswdHash)

      if (!match) {
          throw new Error('Wrong Credentials')
      }

      const userForToken = {
          username: user.username,
          id: user.id
      }

      console.log("Loged")

      return {
          value: jwt.sign(userForToken, JWT_SECRET)
      }
    },
  }
}

app.post('/chat', async (req, res) => {
    try {
      console.log("Ha llegado la petición:", req.body);
  
      // Realiza la petición a OpenAI usando la biblioteca oficial
      const chatResponse = await openai.chat.completions.create({
        messages: req.body.messages, // Asegúrate de enviar los mensajes reales de la petición
        model: "gpt-3.5-turbo",
      });
  
      // Inspeccionar toda la respuesta con más detalle
      console.log("Respuesta completa de OpenAI:", JSON.stringify(chatResponse, null, 2));
  
      // Acceder al contenido de la respuesta
      const assistantMessage = chatResponse.choices[0].message.content;
      console.log("Texto de respuesta de OpenAI:", assistantMessage);

    // Envía el contenido del mensaje de OpenAI al cliente
    res.json({ message: assistantMessage });
    } catch (error) {
      console.error('Error al llamar a OpenAI:', error);
      res.status(error.response?.status || 500).send('Error interno del servidor');
    }
  });

  const startServer = async () => {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: async ({ req }) => {
            const auth = req ? req.headers.authorization : null;
            if (auth && auth.toLowerCase().startsWith('bearer ')) {
                const token = auth.substring(7);
                const {username} = jwt.verify(token, JWT_SECRET);
                const currentUser = await User.findOne({username});
                return { currentUser };
            }
        }
    });

    // Asegúrate de llamar a 'start' antes de 'applyMiddleware'
    await server.start();
    server.applyMiddleware({ app });

    app.listen({ port: PORT }, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    });
};
  
startServer().catch(error => {
  console.error('Error starting server:', error);
});
