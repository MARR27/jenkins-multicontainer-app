pipeline {
    agent any

    environment {
        APP_NAME = 'jenkins-multicontainer-app'
        DOCKER_COMPOSE_FILE = 'docker/docker-compose.test.yml'
        REPORT_DIR = 'coverage'
        EMAIL_TO = 'alfonso040927@gmail.com'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Preparación del Entorno') {
            steps {
                echo 'Clonando repositorio y verificando herramientas...'

                sh 'docker --version'
                sh 'docker compose version'
                sh 'docker-compose --version'
                sh 'node --version'
                sh 'npm --version'
            }
        }

        stage('Instalación de Dependencias') {
            steps {
                echo 'Instalando dependencias del proyecto...'
                sh 'npm ci'
            }
        }

        stage('Pruebas Unitarias') {
            steps {
                echo 'Ejecutando pruebas unitarias...'
                sh 'npm run test:unit'
            }

            post {
                always {
                    junit allowEmptyResults: true, testResults: 'coverage/junit.xml'

                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Cobertura Pruebas Unitarias'
                    ])
                }
            }
        }

        stage('Pruebas de Integración con Servicios') {
            steps {
                echo 'Levantando PostgreSQL, Redis y la aplicación con Docker Compose...'

                sh """
                    docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true
                    docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build
                """

                echo 'Validando estado de los contenedores...'

                sh """
                    docker compose -f ${DOCKER_COMPOSE_FILE} ps
                """

                echo 'Ejecutando pruebas de integración dentro del contenedor app...'

                sh """
                    docker compose -f ${DOCKER_COMPOSE_FILE} exec -T app npm run test:integration
                """
            }

            post {
                always {
                    junit allowEmptyResults: true, testResults: 'coverage/junit.xml'

                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Cobertura Pruebas Integración'
                    ])

                    echo 'Limpiando contenedores de integración...'
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }

                failure {
                    echo 'Las pruebas de integración fallaron. Revisa los logs.'
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} logs || true"
                }
            }
        }

        stage('Prueba End-to-End') {
            when {
                branch 'main'
            }

            steps {
                echo 'Ejecutando prueba end-to-end en la rama main...'

               sh """
    docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true
    docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build
"""

sh """
    echo "Esperando a que la aplicación responda en /health..."

    for i in \$(seq 1 30); do
        if curl -f http://localhost:3000/health; then
            echo "La aplicación ya está lista."
            exit 0
        fi

        echo "Intento \$i: la aplicación aún no responde. Esperando..."
        sleep 3
    done

    echo "La aplicación no respondió después del tiempo esperado."
    docker compose -f ${DOCKER_COMPOSE_FILE} ps
    docker compose -f ${DOCKER_COMPOSE_FILE} logs app
    exit 1
"""

sh """
    curl -f -X POST http://localhost:3000/users \
        -H "Content-Type: application/json" \
        -d '{"name":"E2E Test","email":"e2e@test.com"}'
"""
            }

            post {
                always {
                    echo 'Limpiando contenedores E2E...'
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline multi-contenedor completado exitosamente.'

            mail(
                to: "${EMAIL_TO}",
                subject: "Pipeline exitoso: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
El pipeline multi-contenedor se completó correctamente.

Proyecto: ${env.JOB_NAME}
Build: #${env.BUILD_NUMBER}
URL: ${env.BUILD_URL}

Servicios validados:
- PostgreSQL
- Redis
- Aplicación Node.js
"""
            )
        }

        failure {
            echo 'Pipeline multi-contenedor falló. Revisa los logs.'

            mail(
                to: "${EMAIL_TO}",
                subject: "Pipeline fallido: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
El pipeline multi-contenedor falló.

Proyecto: ${env.JOB_NAME}
Build: #${env.BUILD_NUMBER}
URL: ${env.BUILD_URL}

Revisa la consola para identificar la etapa con error.
"""
            )
        }

        always {
            echo 'Limpieza final del workspace y contenedores...'

            sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"

            cleanWs(
                deleteDirs: true,
                disableDeferredWipeout: true,
                notFailBuild: true
            )
        }
    }
}