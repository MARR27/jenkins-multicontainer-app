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
                    echo "Esperando a que la aplicación responda dentro del contenedor app..."

                    for i in \$(seq 1 30); do
                        if docker compose -f ${DOCKER_COMPOSE_FILE} exec -T app node -e "
                            fetch('http://localhost:3000/health')
                                .then(response => {
                                    if (!response.ok) process.exit(1);
                                    return response.json();
                                })
                                .then(data => {
                                    console.log(data);
                                    process.exit(0);
                                })
                                .catch(() => process.exit(1));
                        "; then
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
                    echo "Preparando tabla users para prueba E2E..."

                    docker compose -f ${DOCKER_COMPOSE_FILE} exec -T postgres psql -U testuser -d testdb -c "
                        CREATE TABLE IF NOT EXISTS users (
                            id SERIAL PRIMARY KEY,
                            name VARCHAR(100) NOT NULL,
                            email VARCHAR(100) UNIQUE NOT NULL
                        );
                    "

                    docker compose -f ${DOCKER_COMPOSE_FILE} exec -T postgres psql -U testuser -d testdb -c "
                        DELETE FROM users WHERE email = 'e2e@test.com';
                    "
                """

                sh """
                    echo "Ejecutando POST /users desde el contenedor app..."

                    docker compose -f ${DOCKER_COMPOSE_FILE} exec -T app node -e "
                        fetch('http://localhost:3000/users', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                name: 'E2E Test',
                                email: 'e2e@test.com'
                            })
                        })
                        .then(response => {
                            if (!response.ok) {
                                console.error('Respuesta HTTP no válida:', response.status);
                                process.exit(1);
                            }

                            return response.json();
                        })
                        .then(data => {
                            console.log(data);
                            process.exit(0);
                        })
                        .catch(error => {
                            console.error(error);
                            process.exit(1);
                        });
                    "
                """
            }

            post {
                always {
                    echo 'Limpiando contenedores E2E...'
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
        }

        stage('Pruebas de Rendimiento') {
            when {
                branch 'main'
            }

            steps {
                echo 'Ejecutando pruebas de rendimiento básicas contra /health...'

                sh """
                    docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true
                    docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build
                """

                sh """
                    echo "Esperando a que la aplicación responda dentro del contenedor app..."

                    for i in \$(seq 1 30); do
                        if docker compose -f ${DOCKER_COMPOSE_FILE} exec -T app node -e "
                            fetch('http://localhost:3000/health')
                                .then(response => {
                                    if (!response.ok) process.exit(1);
                                    return response.json();
                                })
                                .then(data => {
                                    console.log(data);
                                    process.exit(0);
                                })
                                .catch(() => process.exit(1));
                        "; then
                            echo "La aplicación ya está lista para la prueba de rendimiento."
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
                    echo "Enviando 100 solicitudes al endpoint /health..."

                    docker compose -f ${DOCKER_COMPOSE_FILE} exec -T app node -e "
                        const totalRequests = 100;
                        const start = Date.now();

                        async function runPerformanceTest() {
                            let successfulRequests = 0;
                            let failedRequests = 0;

                            for (let i = 1; i <= totalRequests; i++) {
                                try {
                                    const response = await fetch('http://localhost:3000/health');

                                    if (response.ok) {
                                        successfulRequests++;
                                    } else {
                                        failedRequests++;
                                    }
                                } catch (error) {
                                    failedRequests++;
                                }
                            }

                            const duration = Date.now() - start;

                            console.log('Resultados de rendimiento:');
                            console.log('Solicitudes totales:', totalRequests);
                            console.log('Solicitudes exitosas:', successfulRequests);
                            console.log('Solicitudes fallidas:', failedRequests);
                            console.log('Tiempo total en ms:', duration);
                            console.log('Promedio por solicitud en ms:', duration / totalRequests);

                            if (failedRequests > 0) {
                                process.exit(1);
                            }

                            process.exit(0);
                        }

                        runPerformanceTest();
                    "
                """
            }

            post {
                always {
                    echo 'Limpiando contenedores de pruebas de rendimiento...'
                    sh "docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true"
                }
            }
        }

        stage('Monitoreo de Servicios') {
            when {
                branch 'main'
            }

            steps {
                echo 'Ejecutando monitoreo de servicios PostgreSQL y Redis...'

                sh """
                    docker compose -f ${DOCKER_COMPOSE_FILE} down -v || true
                    docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build
                """

                sh """
                    echo "Estado actual de los contenedores:"
                    docker compose -f ${DOCKER_COMPOSE_FILE} ps
                """

                sh """
                    echo "Logs recientes de PostgreSQL:"
                    docker compose -f ${DOCKER_COMPOSE_FILE} logs --tail=20 postgres
                """

                sh """
                    echo "Logs recientes de Redis:"
                    docker compose -f ${DOCKER_COMPOSE_FILE} logs --tail=20 redis
                """

                sh """
                    echo "Logs recientes de la aplicación:"
                    docker compose -f ${DOCKER_COMPOSE_FILE} logs --tail=20 app
                """
            }

            post {
                always {
                    echo 'Limpiando contenedores de monitoreo...'
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
- Pruebas de rendimiento básicas
- Monitoreo de servicios
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