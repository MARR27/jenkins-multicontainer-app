FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción y desarrollo
RUN npm ci

# Copiar código fuente y pruebas
COPY src/ ./src/
COPY tests/ ./tests/
COPY jest.config.js ./

# Exponer puerto de la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]