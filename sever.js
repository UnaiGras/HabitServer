const express = require('express');
const { OpenAI } = require("openai");
require('./dbconn')
require('dotenv').config();
const jwt = require("jsonwebtoken")
const bcrypt = require('bcrypt')
const app = express();
const { gql} = require('apollo-server')
const { ApolloServer } = require('apollo-server-express');
const { v4: uuidv4 } = require('uuid');
const User = require("./models/user")
const DuelRequest = require("./models/duelRequest")
const DuelHabit = require("./models/duelHabits")
const Duel = require("./models/duel")


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
    duelRequests: [DuelRequest!]!
   duels: [Duel!]!
   points: Int
  }

  type Token {
    value: String!
  }

  type DuelRequest {
    id: ID!
    from: User!
    to: User!
    duel: Duel!
    sendingDate: String!
    status: String!
  }
  
  type Duel {
    id: ID!
    name: String
    challenger: User!
    challenged: User!
    habits: [DuelHabit!]!
    challengerPoints: Int
    challengedPoints: Int
    durationDays: Int
    startTime: String
    finishTime: String
    points: Int
  }
  
  type DuelHabit {
    id: ID!
    name: String!
    icon: String
    desc: String!
    duration: Int!
    points: Int!
    color: String!
    lastCompletedDate: String!
    subTasks: [SubTask!]!
    challengerLastCompletedDate: String!
    challengedLastCompletedDate: String!
  }
  
  type SubTask {
    id: Int!
    name: String!
    lastCompletedDate: String!
  }

  input SubTaskInput {
    id: Int!
    name: String!
    lastCompletedDate: String!
  }
  
  input DuelHabitInput {
    name: String!
    icon: String
    desc: String!
    duration: Int!
    points: Int!
    color: String!
    lastCompletedDate: String!
    subTasks: [SubTaskInput]!
    challengerLastCompletedDate: String!
    challengedLastCompletedDate: String!
  }
  
  input DuelInput {
    name: String
    durationDays: Int!
    points: Int!
  }
  
  input GenerateAndSendDuelRequestInput {
    duelHabitsInput: [DuelHabitInput]!
    duelInput: DuelInput!
    toUserId: ID!
  }
  
  input AcceptDuelRequestInput {
    requestId: ID!
  }

  type Query {
    me: User
    isUserPremium: Boolean!
    duelRequestsPending: [DuelRequest!]!
    activeDuels: [Duel!]!
    duelDetails(duelId: ID!): Duel
    searchUsers(searchString: String!): [User!]!
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
    makeUserPremium(userId: ID!): User!
    generateAndSendDuelRequest(input: GenerateAndSendDuelRequestInput!): DuelRequest!
    acceptDuelRequest(input: AcceptDuelRequestInput!): Duel!
    completeHabit(
      duelId: ID!
      habitId: ID!
    ): DuelHabit!
  }
`

const resolvers = {
  Query: {
    me: async(root, args, context) => {
      const me = await User.findOne({_id: context.currentUser._id})
      
      return me
    },
    isUserPremium: async (_, args, { currentUser }) => {
      // Asumiendo que `currentUser` ya tiene el `_id` del usuario autenticado
      if (!currentUser._id) throw new Error('Not authenticated');
  
      const user = await User.findById(currentUser._id);
      if (!user) throw new Error('User not found');
  
      return user.premium;
    },
    duelRequestsPending: async (_, __, { currentUser }) => {
      // Obtener el usuario actual con sus solicitudes de duelo pendientes
      const user = await User.findById(currentUser)
        .populate({
          path: 'duelRequests',
          match: { status: { $ne: "accepted" } }, // Filtrar solo las solicitudes no aceptadas
          populate: {
            path: 'duel',
            populate: { path: 'habits' } // Hacer populate de los hábitos asociados al duelo
          }
        })
        .populate({
          path: 'duelRequests',
          populate: {
            path: 'from to',
            select: 'username name' // Seleccionar solo algunos campos del usuario
          }
        });
    
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
    
      // Devolver las solicitudes de duelo pendientes del usuario
      return user.duelRequests;
    },
    
    activeDuels: async (_, __, { currentUser }) => {
      const user = await User.findById(currentUser).populate('duels');
      if (!user) {
        throw new Error('Usuario no encontrado');
      }
      // Filtrar duelos activos basados en la fecha actual
      const now = new Date();
      const activeDuels = user.duels.filter(duel => duel.startTime <= now && duel.finishTime >= now);
      return activeDuels;
    },
    
    duelDetails: async (_, { duelId }, context) => {
      const duel = await Duel.findById(duelId)
        .populate({
          path: 'habits',
          populate: { path: 'subTasks' }
        })
        .populate('challenger', 'username name')
        .populate('challenged', 'username name');
      return duel;
    },
    searchUsers: async (_, { searchString }, context) => {
      const regex = new RegExp(searchString, 'i'); // 'i' para búsqueda insensible a mayúsculas
      const users = await User.find({
        $or: [
          { username: { $regex: regex } },
          { name: { $regex: regex } }
        ]
      });
      return users;
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
    makeUserPremium: async (_, { userId }) => {
      // Encuentra el usuario por ID y actualiza el campo premium a true
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { premium: true },
        { new: true } // Esto es para que Mongoose devuelva el documento modificado
      );
  
      if (!updatedUser) {
        throw new Error('User not found');
      }
  
      console.log("User made premium");
  
      return updatedUser;
    },
    generateAndSendDuelRequest: async (_, { duelHabitsInput, duelInput, toUserId }, { currentUser }) => {
      // Asumiendo que currentUser ya contiene el ID del usuario en sesión (el que envía la solicitud)
      
      // 1. Crear los DuelHabits
      const duelHabits = await Promise.all(duelHabitsInput.map(async (habit) => {
        const newDuelHabit = new DuelHabit(habit);
        await newDuelHabit.save();
        return newDuelHabit._id;
      }));
      
      // 2. Crear el Duel
      const newDuel = new Duel({
        ...duelInput,
        challenger: currentUser._id,
        challenged: toUserId,
        habits: duelHabits,
      });
      await newDuel.save();
      
      // 3. Crear la DuelRequest
      const newDuelRequest = new DuelRequest({
        from: currentUser._id,
        to: toUserId,
        duel: newDuel._id,
        sendingDate: new Date(),
        status: "pending", // o el estado inicial que prefieras
      });
      await newDuelRequest.save();
      
      // 4. Añadir la solicitud al usuario destinatario
      await User.findByIdAndUpdate(toUserId, {
        $push: { duelRequests: newDuelRequest._id }
      });
      
      return newDuelRequest; // O lo que desees retornar
    },
    acceptDuelRequest: async (_, { requestId }, { currentUser }) => {
      // Asumiendo que currentUser ya contiene el ID del usuario que acepta la solicitud
      
      // 1. Obtener la solicitud y el duelo asociado
      const request = await DuelRequest.findById(requestId).populate('duel');
      if (!request) {
        throw new Error('Solicitud no encontrada');
      }
      
      // 2. Verificar que el currentUser es el destinatario de la solicitud
      if (request.to.toString() !== currentUser._id) {
        throw new Error('No tienes permiso para aceptar esta solicitud');
      }
      
      // 3. Actualizar el estado de la solicitud a aceptado
      request.status = 'accepted';
      await request.save();
      
      // 4. Establecer las fechas de inicio y finalización del duelo
      const startTime = new Date();
      const finishTime = new Date(startTime.getTime() + request.duel.durationDays * 24 * 60 * 60 * 1000);
      
      request.duel.startTime = startTime;
      request.duel.finishTime = finishTime;
      await request.duel.save();
      
      // 5. Añadir el duelo a los usuarios (retador y retado)
      await User.findByIdAndUpdate(request.from, { $push: { duels: request.duel._id } });
      await User.findByIdAndUpdate(request.to, { $push: { duels: request.duel._id } });
      
      return request.duel; // O lo que desees retornar
    },
    completeHabit: async (_, { duelId, habitId }, { currentUser }) => {
      // Buscar el Duelo por ID para obtener el retador y el retado
      const duel = await Duel.findById(duelId);
      if (!duel) {
        throw new Error('Duelo no encontrado');
      }
    
      // Verificar si el currentUser._id es el retador o el retado en el duelo
      let isChallenger = duel.challenger.toString() === currentUser._id;
      let isChallenged = duel.challenged.toString() === currentUser._id;
    
      if (!isChallenger && !isChallenged) {
        throw new Error('El usuario no es parte de este duelo');
      }
    
      // Buscar el DuelHabit específico por habitId dentro del Duelo
      const habit = await DuelHabit.findById(habitId);
      if (!habit) {
        throw new Error('Hábito no encontrado');
      }
    
      // Actualizar la última fecha de completado del hábito y del retador/retado específico
      const lastCompletedDate = new Date(); // Fecha y hora actuales
      habit.lastCompletedDate = lastCompletedDate;
    
      if (isChallenger) {
        habit.challengerLastCompletedDate = lastCompletedDate;
      } else if (isChallenged) {
        habit.challengedLastCompletedDate = lastCompletedDate;
      }
    
      await habit.save();
    
      // Aquí podrías implementar lógica adicional, como actualizar puntos si es necesario
    
      return habit; // Retornar el hábito actualizado
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
            console.log("Somethinghappening")
            if (auth && auth.toLowerCase().startsWith('bearer ')) {
                const token = auth.substring(7);
                const {username} = jwt.verify(token, JWT_SECRET);
                const currentUser = await User.findOne({username});
                console.log("Somethinghappeninglogged")
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
